import winston = require("winston");
import async from "async";
import { EventEmitter } from "events";

export class DeviceController extends EventEmitter {
    gpio: any;
    logger: winston.Logger;
    //     pi@GRGE-PI01:~ $ gpio mode 21 down
    // pi@GRGE-PI01:~ $ gpio mode 22 down
    // pi@GRGE-PI01:~ $ gpio mode 23 down
    // pi@GRGE-PI01:~ $ gpio mode 25 down
    // pi@GRGE-PI01:~ $ gpio mode 27 down
    initPulldown(pin: number) {
        const { exec } = require("child_process");
        var thys = this;
        exec(
            "gpio mode " + pin.toString() + " down",
            (err: any, stdout: any, stderr: any) => {
                if (err) {
                    thys.logger.error("error setting pin: " + err.toString());
                    return;
                }

                // the *entire* stdout and stderr (buffered)
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);
            }
        );
    }
    constructor(logger: winston.Logger, callback: any) {
        super();
        this.gpio = require("rpi-gpio");
        this.logger = logger;
        let thys = this;
        this.gpio.on("change", this.changedState.bind(this));

        async.series([
            function(callback: any) {
                thys.gpio.setup(thys.left_button, thys.gpio.DIR_OUT, callback);
            },
            function(callback: any) {
                thys.gpio.setup(thys.right_button, thys.gpio.DIR_OUT, callback);
            },
            function(callback: any) {
                thys.gpio.setup(
                    thys.person_door,
                    thys.gpio.DIR_IN,
                    thys.gpio.EDGE_BOTH,
                    callback
                );
                thys.initPulldown(thys.person_door);
            },
            function(callback: any) {
                thys.gpio.setup(
                    thys.left_closed,
                    thys.gpio.DIR_IN,
                    thys.gpio.EDGE_BOTH,
                    callback
                );
                thys.initPulldown(thys.left_closed);
            },
            function(callback: any) {
                thys.gpio.setup(
                    thys.left_open,
                    thys.gpio.DIR_IN,
                    thys.gpio.EDGE_BOTH,
                    callback
                );
                thys.initPulldown(thys.left_open);
            },
            function(callback: any) {
                thys.gpio.setup(
                    thys.right_closed,
                    thys.gpio.DIR_IN,
                    thys.gpio.EDGE_BOTH,
                    callback
                );
                thys.initPulldown(thys.right_closed);
            },
            function(callback: any) {
                thys.gpio.setup(
                    thys.right_open,
                    thys.gpio.DIR_IN,
                    thys.gpio.EDGE_BOTH,
                    callback
                );
                thys.initPulldown(thys.right_open);
            },
            function(callback: any) {
                thys.gpio.read(thys.right_open, function(
                    err: any,
                    value: boolean
                ) {
                    if (!err) {
                        thys.changedState(thys.right_open, value);
                    } else {
                        thys.logger.error(err.toString());
                    }
                    callback();
                });
            },
            function(callback: any) {
                thys.gpio.read(thys.right_closed, function(
                    err: any,
                    value: boolean
                ) {
                    if (!err) {
                        thys.changedState(thys.right_closed, value);
                    } else {
                        thys.logger.error(err.toString());
                    }
                    callback();
                });
            },
            function(callback: any) {
                thys.gpio.read(thys.left_open, function(
                    err: any,
                    value: boolean
                ) {
                    if (!err) {
                        thys.changedState(thys.left_open, value);
                    } else {
                        thys.logger.error(err.toString());
                    }
                    callback();
                });
            },
            function(callback: any) {
                thys.gpio.read(thys.left_closed, function(
                    err: any,
                    value: boolean
                ) {
                    if (!err) {
                        thys.changedState(thys.left_closed, value);
                    } else {
                        thys.logger.error(err.toString());
                    }
                    callback();
                });
            },
            function(callback: any) {
                thys.gpio.read(thys.person_door, function(
                    err: any,
                    value: boolean
                ) {
                    if (!err) {
                        thys.changedState(thys.person_door, value);
                    } else {
                        thys.logger.error(err.toString());
                    }
                    callback();
                });
            }
        ]);

        this.logger.info("Initialized GPIOs");
        callback();
    }
    public ToggleLeftButton() {
        this.PressButton(Side.LEFT, 2);
    }
    public ToggleRightButton() {
        this.PressButton(Side.RIGHT, 2);
    }
    public PressButton(side: Side, duration: number) {
        let pin: number = 0;
        if (side === Side.LEFT) {
            pin = this.left_button;
        } else {
            pin = this.right_button;
        }
        this.logger.info("Starting " + Side[side].toString() + " button push");
        this.StartPush(pin);
        setTimeout(this.EndPush.bind(this, pin), duration * 1000);
    }
    private StartPush(pin: number) {
        try {
            this.gpio.write(pin, true);
            this.logger.info("Pushing button on pin " + pin.toString());
        } catch (err) {
            this.logger.error(
                "Error pushing button on pin " +
                    pin.toString() +
                    " : " +
                    JSON.stringify(err)
            );
        }
    }
    private EndPush(pin: number) {
        try {
            this.gpio.write(pin, false);
            this.logger.info("Ending pushing button on pin " + pin.toString());
        } catch (err) {
            this.logger.error(
                "Error pushing button on pin " +
                    pin.toString() +
                    " : " +
                    JSON.stringify(err)
            );
        }
    }
    private changedState(channel: any, value: any) {
        //this.logger.info("Channel " + channel + " value is now " + value);
        //reed switch true = contacted/closed
        switch (channel) {
            case this.left_open:
                if (this.leftDoorOpenSensorClosed !== value) {
                    this.lastLeftDoorState = this.LeftDoorState;
                    this.leftDoorOpenSensorClosed = value;
                    this.logger.info(
                        "LEFT door state: " +
                            DoorState[this.LeftDoorState].toString()
                    );
                    this.emit("status", Side.LEFT, this.LeftDoorState);
                }
                break;
            case this.right_open:
                if (this.rightDoorOpenSensorClosed !== value) {
                    this.lastRightDoorState = this.RightDoorState;
                    this.rightDoorOpenSensorClosed = value;
                    this.logger.info(
                        "RIGHT door state: " +
                            DoorState[this.RightDoorState].toString()
                    );
                    this.emit("status", Side.RIGHT, this.RightDoorState);
                }
                break;
            case this.left_closed:
                if (this.leftDoorClosedSensorClosed !== value) {
                    this.lastLeftDoorState = this.LeftDoorState;
                    this.leftDoorClosedSensorClosed = value;
                    this.logger.info(
                        "LEFT door state: " +
                            DoorState[this.LeftDoorState].toString()
                    );
                    this.emit("status", Side.LEFT, this.LeftDoorState);
                }
                break;
            case this.right_closed:
                if (this.rightDoorClosedSensorClosed !== value) {
                    this.lastRightDoorState = this.RightDoorState;
                    this.rightDoorClosedSensorClosed = value;
                    this.logger.info(
                        "RIGHT door state: " +
                            DoorState[this.RightDoorState].toString()
                    );
                    this.emit("status", Side.RIGHT, this.RightDoorState);
                }
                break;
            case this.person_door:
                if (this.personDoorOpenSensorClosed !== value) {
                    this.personDoorOpenSensorClosed = value;
                    this.logger.info(
                        "PERSON door state: " +
                            DoorState[this.PersonDoorState].toString()
                    );
                    this.emit("status", Side.PERSON, this.PersonDoorState);
                }

                break;
        }
    }

    //pins l-cl 23 op-22 r op-27 p-25
    left_button: number = 11; //bcm_17
    right_button: number = 12; //bcm_18
    person_door: number = 22; //bcm_25-
    left_open: number = 31; //bcm_6-
    left_closed: number = 33; //bcm_13-
    right_open: number = 36; //bcm_16
    right_closed: number = 37; //bcm_26
    get PersonDoorState(): DoorState {
        let retVal: DoorState = DoorState.UNKNOWN;
        if (this.personDoorOpenSensorClosed) {
            retVal = DoorState.CLOSED;
        } else {
            retVal = DoorState.OPEN;
        }

        return retVal;
    }
    get LeftDoorState(): DoorState {
        let retVal: DoorState = DoorState.UNKNOWN;
        if (this.leftDoorClosedSensorClosed) {
            if (this.leftDoorOpenSensorClosed) {
                retVal = DoorState.ERROR;
            } else {
                retVal = DoorState.CLOSED;
            }
        } else {
            if (this.leftDoorOpenSensorClosed) {
                retVal = DoorState.OPEN;
            } else {
                if (this.lastLeftDoorState === DoorState.CLOSED) {
                    retVal = DoorState.OPENING;
                } else {
                    retVal = DoorState.CLOSING;
                }
            }
        }
        return retVal;
    }
    private lastLeftDoorState: DoorState = DoorState.UNKNOWN;
    get RightDoorState(): DoorState {
        let retVal: DoorState = DoorState.UNKNOWN;
        if (this.rightDoorClosedSensorClosed) {
            if (this.rightDoorOpenSensorClosed) {
                retVal = DoorState.ERROR;
            } else {
                retVal = DoorState.CLOSED;
            }
        } else {
            if (this.rightDoorOpenSensorClosed) {
                retVal = DoorState.OPEN;
            } else {
                if (this.lastRightDoorState === DoorState.CLOSED) {
                    retVal = DoorState.OPENING;
                } else {
                    retVal = DoorState.CLOSING;
                }
            }
        }
        return retVal;
    }
    private lastRightDoorState: DoorState = DoorState.UNKNOWN;
    leftDoorOpenSensorClosed: boolean = false;
    leftDoorClosedSensorClosed: boolean = false;
    rightDoorOpenSensorClosed: boolean = false;
    rightDoorClosedSensorClosed: boolean = false;
    personDoorOpenSensorClosed: boolean = false;
}

export enum DoorState {
    ERROR,
    UNKNOWN,
    CLOSED,
    CLOSING,
    OPENING,
    OPEN
}
export enum Side {
    LEFT,
    RIGHT,
    PERSON
}
