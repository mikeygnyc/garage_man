import winston = require("winston");
import { EventEmitter } from "events";

export class Door extends EventEmitter {
    constructor(type: DoorType, side: Side, logger: winston.Logger) {
        super();
        this.type = type;
        this._openSensor = false;
        this.side = side;
        if (type === DoorType.OVERHEAD) {
            this._closedSensor = false;
        }
        this.lastDoorState = DoorState.INIT;
        this.logger = logger;
    }
    logger: winston.Logger;
    side: Side;
    get state(): DoorState {
        let retVal: DoorState = DoorState.UNKNOWN;
        if (this.type === DoorType.OVERHEAD) {
            if (this.closedSensor) {
                //closed=true
                if (this.openSensor) {
                    retVal = DoorState.ERROR; //closed == true && open ==true
                } else {
                    retVal = DoorState.CLOSED; //closed==true && open == false
                }
            } else {
                //closed==false
                if (this.openSensor) {
                    retVal = DoorState.OPEN; //closed==false&&open==true
                } else {
                    if (this.lastDoorState === DoorState.CLOSED) {
                        retVal = DoorState.OPENING; //closed==false && open == false && prevstate==closed
                    } else {
                        retVal = DoorState.CLOSING;//closed==false && open == false && prevstate!=closed
                    }
                }
            }
        } else {
            if (this.openSensor) {
                retVal = DoorState.CLOSED;
            } else {
                retVal = DoorState.OPEN;
            }
        }

        return retVal;
    }
    private lastDoorState: DoorState;
    type: DoorType;
    get openSensor(): boolean {
        return this._openSensor;
    }
    set openSensor(value: boolean) {
        if (value !== this._openSensor) {
            this.lastDoorState = this.state;
            this._openSensor = value;
            this.logger.info(
                Side[this.side].toString() +
                    " door state: " +
                    DoorState[this.state].toString()
            );
            this.emit("state", this);
        }
    }
    private _openSensor: boolean;
    get closedSensor(): boolean {
        if (this._closedSensor) {
            return this._closedSensor;
        } else {
            return false;
        }
    }
    set closedSensor(value: boolean) {
        if (value !== this._closedSensor) {
            this.lastDoorState = this.state;
            this._closedSensor = value;
            this.logger.info(
                Side[this.side].toString() +
                    " door state: " +
                    DoorState[this.state].toString()
            );
            this.emit("state", this);
        }
    }
    private _closedSensor?: boolean;
}

export enum DoorType {
    OVERHEAD,
    STANDARD
}
export enum DoorState {
    ERROR,
    INIT,
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
