import winston = require("winston");
import async from "async";
import { EventEmitter } from "events";
import { Door, DoorType, Side } from "./door";

export class DeviceController extends EventEmitter {
    gpio: any;
    logger: winston.Logger;
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
        this.leftDoor = new Door(DoorType.OVERHEAD, Side.LEFT, this.logger);
        this.rightDoor = new Door(DoorType.OVERHEAD, Side.RIGHT, this.logger);
        this.personDoor = new Door(DoorType.STANDARD, Side.PERSON, this.logger);
        this.leftDoor.on("state", this.handleDoorStateChange.bind(this));
        this.rightDoor.on("state", this.handleDoorStateChange.bind(this));
        this.personDoor.on("state", this.handleDoorStateChange.bind(this));
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
    private handleDoorStateChange(door: Door) {
        this.emit("status", door.side, door.state);
    }
    private changedState(channel: any, value: any) {
        //this.logger.info("Channel " + channel + " value is now " + value);
        //reed switch true = contacted/closed
        setTimeout(this.debounce.bind(this), 250, channel, value);
    }
    private debounce(pin: number, origValue: boolean) {
        var thys = this;
        this.gpio.read(pin, function(err: any, value: boolean) {
            if (!err) {
                if (value===origValue){
                    switch (pin) {
                        case thys.left_open:
                            thys.leftDoor.openSensor = value;
                            break;
                        case thys.right_open:
                            thys.rightDoor.openSensor = value;
                            break;
                        case thys.left_closed:
                            thys.leftDoor.closedSensor = value;
                            break;
                        case thys.right_closed:
                            thys.rightDoor.closedSensor = value;
                            break;
                        case thys.person_door:
                            thys.personDoor.openSensor = value;
                            break;
                    }
                }
            } else {
                thys.logger.error("debouncer error: " + err.toString());
            }
        });
    }
    //pins l-cl 23 op-22 r op-27 p-25
    left_button: number = 11; //bcm_17
    right_button: number = 12; //bcm_18
    person_door: number = 22; //bcm_25-
    left_open: number = 31; //bcm_6-
    left_closed: number = 33; //bcm_13-
    right_open: number = 36; //bcm_16
    right_closed: number = 37; //bcm_26

    public personDoor: Door;
    public leftDoor: Door;
    public rightDoor: Door;
}
