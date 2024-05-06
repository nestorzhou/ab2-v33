// Draw battery icon
// Level 4: full
// Level 3: medium-high
// Level 2: medium-low
// Level 1: low
// Level 0: Empty
function batteryIcon (level: number) {
    led.plot(2, 4)
    led.plot(2, 0)
    for (let index = 0; index <= 3; index++) {
        led.plot(1, index + 1)
        led.plot(3, index + 1)
    }
    if (level > 0) {
        for (let index2 = 0; index2 <= level; index2++) {
            led.plot(2, 5 - index2)
        }
    } else {
        led.plot(0, 0)
        led.plot(2, 2)
        led.plot(4, 4)
    }
}
function servo1_test () {
    pins.digitalWritePin(DigitalPin.P1, 1)
    control.waitMicros(1500 + roll * 10)
    pins.digitalWritePin(DigitalPin.P1, 0)
}
function JoystickDeadBand () {
    if (Math.abs(roll) < 5) {
        roll = 0
    }
    if (Math.abs(pitch) < 5) {
        pitch = 0
    }
}
function screen () {
    // If charging is detected
    if (pins.analogReadPin(AnalogPin.P0) > 750) {
        // Charge mode can not happen when drone is flying
        if (arm == 0) {
            charging()
        }
    } else {
        if (mode == 0) {
            dots()
        }
        if (mode == 1) {
            led.plotBarGraph(
            airbit.batteryLevel(),
            100
            )
        }
        if (mode == 2) {
            basic.showNumber(throttle)
        }
        if (mode == 3) {
            motorTest()
        }
        if (mode == 4) {
            basic.clearScreen()
            motorLed()
        }
        if (mode == 5) {
            basic.showNumber(airbit.batterymVolt())
        }
    }
}
function mainLoop () {
    while (true) {
        // Read raw data from gyro and accelerometer
        airbit.IMU_sensorRead()
        // Find drone's absolute Roll, Pitch and Yaw angles with sensor fusion, gyro and accelerometer together.
        airbit.calculateAngles()
        basic.pause(1)
        lostSignalCheck()
        if (motorTesting == false) {
            // The "magic" algorithm that stabilises the drone based on setpoint angle and actual angle, finding the difference and chanring motor speed to compensate.
            airbit.stabilisePid()
        }
        // If upside down while armed, disable flying
        if (Math.abs(imuRoll) > 90) {
            stable = false
        } else {
            stable = true
        }
        // Only start motors if armed, stable, motor controller and gyro is operating
        if (arm && stable && (mcExists && (gyroExists && notCharging))) {
            if (throttle == 0) {
                // Idle speed of motors
                airbit.MotorSpeed(
                5,
                5,
                5,
                5
                )
            } else {
                airbit.MotorSpeed(
                motorA,
                motorB,
                motorC,
                motorD
                )
            }
        } else {
            // Clear registers for error compensation algorithms, do not keep errors from past flight.
            airbit.cleanReg()
            if (motorTesting) {
                airbit.MotorSpeed(
                motorA,
                motorB,
                motorC,
                motorD
                )
            } else {
                airbit.MotorSpeed(
                0,
                0,
                0,
                0
                )
            }
        }
        cpuTime = input.runningTime() - startTime
        startTime = input.runningTime()
    }
}
input.onButtonPressed(Button.A, function () {
    mode += -1
    if (mode < 0) {
        mode = 5
    }
})
function radioSendData () {
    radio.sendValue("Pd", Math.round(imuPitch))
    radio.sendValue("Rd", Math.round(imuRoll))
    radio.sendValue("Td", input.temperature())
    radio.sendValue("B", batterymVoltSmooth)
    radio.sendValue("G", input.acceleration(Dimension.Z))
    radio.sendValue("S", input.soundLevel())
}
function gyroAccBubble () {
	
}
input.onButtonPressed(Button.AB, function () {
    mode = 0
})
input.onButtonPressed(Button.B, function () {
    mode += 1
    if (mode > 5) {
        mode = 0
    }
})
function motorLed () {
    basic.clearScreen()
    led.plotBrightness(0, 4, motorA)
    led.plotBrightness(0, 0, motorB)
    led.plotBrightness(4, 4, motorC)
    led.plotBrightness(4, 0, motorD)
    led.plot(Math.map(imuRoll, -15, 15, 0, 4), Math.map(imuPitch, -15, 15, 4, 0))
}
radio.onReceivedValue(function (name, value) {
    radioReceivedTime = input.runningTime()
    if (name == "P") {
        pitch = expo(value) / -3
        pitch = Math.constrain(pitch, -15, 15)
    }
    if (name == "A") {
        arm = value
    }
    if (name == "R") {
        roll = expo(value) / 3
        roll = Math.constrain(roll, -15, 15)
    }
    if (name == "T") {
        throttle = value
        throttle = Math.constrain(throttle, 0, 100)
        if (batterymVoltSmooth < 3400) {
            throttle = Math.constrain(throttle, 0, 75)
        }
    }
    if (name == "Y") {
        yaw += value * 0.1
    }
})
// smartBar(0, throttle)
// smartBar(4, airbit.batteryLevel())
function dots () {
    basic.clearScreen()
    led.plot(Math.map(roll, -15, 15, 0, 4), Math.map(pitch, -15, 15, 4, 0))
    led.plot(Math.map(yaw, -30, 30, 0, 4), 4)
    if (arm) {
        led.plot(0, 0)
    }
    if (stable && (mcExists && (gyroExists && notCharging))) {
        led.plot(2, 0)
    }
    airbit.smartBar(0, throttle)
    airbit.smartBar(4, airbit.batteryLevel())
}
function charging () {
    if (AnalogP0Switch - pins.analogReadPin(AnalogPin.P0) > 20) {
        basic.showString("Connect battery",100)
    } else {
        basic.pause(200)
    }
    AnalogP0Switch = pins.analogReadPin(AnalogPin.P0)
    if (pins.analogReadPin(AnalogPin.P0) < 900) {
        basic.clearScreen()
        for (let index3 = 0; index3 <= 3; index3++) {
            batteryIcon(index3 + 1)
            basic.pause(500)
        }
        notCharging = false
    } else {
        basic.showIcon(IconNames.Yes)
        basic.showString("Charge finished!")
        notCharging = true
        AnalogP0Switch += 1
    }
}
function lostSignalCheck () {
    // Failsafe makes only sense if already flying
    if (throttle > 65 && arm) {
        if (input.runningTime() > radioReceivedTime + 3000) {
            roll = 0
            pitch = 0
            yaw = 0
            throttle = 65
        }
        if (input.runningTime() > radioReceivedTime + 8000) {
            roll = 0
            pitch = 0
            yaw = 0
            throttle = 0
            arm = 0
        }
    }
}
function motorTest () {
    motorA = 0
    motorB = 0
    motorC = 0
    motorD = 0
    motorTesting = true
    motorB = 5
    for (let index = 0; index < 50; index++) {
        basic.clearScreen()
        airbit.rotateDot(
        1,
        1,
        1,
        10
        )
        basic.pause(20)
    }
    motorB = 0
    motorD = 5
    for (let index = 0; index < 50; index++) {
        basic.clearScreen()
        airbit.rotateDot(
        3,
        1,
        1,
        -10
        )
        basic.pause(20)
    }
    motorD = 0
    motorC = 5
    for (let index = 0; index < 50; index++) {
        basic.clearScreen()
        airbit.rotateDot(
        3,
        3,
        1,
        10
        )
        basic.pause(20)
    }
    motorC = 0
    motorA = 5
    for (let index = 0; index < 50; index++) {
        basic.clearScreen()
        airbit.rotateDot(
        1,
        3,
        1,
        -10
        )
        basic.pause(20)
    }
    motorA = 0
    motorTesting = false
}
function simpleBatteryCheck () {
    basic.clearScreen()
    if (airbit.batterymVolt() > 4050) {
        batteryIcon(4)
    } else if (airbit.batterymVolt() > 3900) {
        batteryIcon(3)
    } else if (airbit.batterymVolt() > 3750) {
        batteryIcon(2)
    } else if (airbit.batterymVolt() > 3600) {
        batteryIcon(1)
    } else {
        batteryIcon(0)
    }
}
function expo (inp: number) {
    if (inp >= 0) {
        return inp / expoSetting + inp * inp / expoFactor
    } else {
        return inp / expoSetting - inp * inp / expoFactor
    }
}
let AnalogP0Switch = 0
let yaw = 0
let radioReceivedTime = 0
let startTime = 0
let cpuTime = 0
let motorTesting = false
let throttle = 0
let mode = 0
let pitch = 0
let roll = 0
let arm = 0
let expoFactor = 0
let expoSetting = 0
let motorD = 0
let motorB = 0
let motorC = 0
let motorA = 0
let batterymVoltSmooth = 0
let imuRoll = 0
let imuPitch = 0
let notCharging = false
let stable = false
let gyroExists = false
let mcExists = false
let imuYaw = 0
let batteryVolt = 0
mcExists = false
gyroExists = false
stable = true
notCharging = true
let radioGroup = 7
basic.showNumber(radioGroup)
simpleBatteryCheck()
basic.pause(1000)
imuPitch = 0
imuRoll = 0
batterymVoltSmooth = 3700
// Default: 0.7
let rollPitchP = 0.9
let rollPitchI = 0.004
// Default: 15
let rollPitchD = 15
// Default: 4
let yawP = 5
// Default: 10
let yawD = 70
motorA = 0
motorC = 0
motorB = 0
motorD = 0
expoSetting = 2
expoFactor = 45 * 45 / (45 - 45 / expoSetting)
radio.setGroup(radioGroup)
i2crr.setI2CPins(DigitalPin.P2, DigitalPin.P1)
// i2crr.setI2CPins(DigitalPin.P2, DigitalPin.P1)
basic.pause(100)
airbit.IMU_Start()
basic.pause(100)
airbit.PCA_Start()
while (mcExists == false) {
    airbit.PCA_Start()
    basic.showString("Connect battery",100)
}
basic.showString("M")
airbit.IMU_gyro_calibrate()
while (arm) {
    basic.showString("Disarm!")
}
basic.forever(function () {
    mainLoop()
})
basic.forever(function () {
    airbit.batteryCalculation()
})
basic.forever(function () {
    if (stable == false && arm) {
        basic.showString("Tilted. Please reset.")
    } else if (batterymVoltSmooth > 3400) {
        screen()
    } else if (batterymVoltSmooth > 3350) {
        batteryIcon(1)
    } else {
        basic.clearScreen()
        batteryIcon(0)
        basic.pause(1000)
        basic.clearScreen()
        basic.pause(1000)
    }
})
