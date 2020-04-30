import express from "express";
import cors from "cors";
import morgan from "morgan";
import winston from "winston";
import logform from "logform";
import fs from "fs";
import path from "path";
import { DeviceController } from "./device_controller";
import * as mqtt from "mqtt";
import { MqttClient, IClientPublishOptions } from "mqtt";
import { DoorState, Side } from "./door";
const { format } = logform;
const alignedWithColorsAndTime = format.combine(
    format.timestamp(),
    format.align(),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);
const logger = winston.createLogger({
    format: alignedWithColorsAndTime,
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "garage.log", maxsize: 1024*1024*1024  })
    ]
});

const app = express();
app.use(cors());
var accessLogStream = fs.createWriteStream(path.join(__dirname, "access.log"), {
    flags: "a"
});

// setup the logger
app.use(morgan("combined", { stream: accessLogStream }));

const GarageState: DeviceController = new DeviceController(
    logger,
    function() {}
);
GarageState.on("status", garageStatusChanged);
const leftCtlTopic:string="home/garage/left_door_ctl";
const rightCtlTopic:string="home/garage/right_door_ctl";
const mqttBroker:string= "mqtt://mqtt.galesnet.com";
const leftDoorStatusTopic:string="home/garage/left_door";
const rightDoorStatusTopic:string="home/garage/right_door";
const personDoorStatusTopic:string="home/garage/person_door";
let left_opts: mqtt.IClientOptions = {};
left_opts.will = {
    topic: leftDoorStatusTopic,
    payload: "UNKNOWN",
    qos: 2,
    retain: true
};
let right_opts: mqtt.IClientOptions = {};
right_opts.will = {
    topic: rightDoorStatusTopic,
    payload: "UNKNOWN",
    qos: 2,
    retain: true
};
let person_opts: mqtt.IClientOptions = {};
person_opts.will = {
    topic: personDoorStatusTopic,
    payload: "UNKNOWN",
    qos: 2,
    retain: true
};

let left_door_client: MqttClient = mqtt.connect(
    mqttBroker,
    left_opts
);
let right_door_client: MqttClient = mqtt.connect(
    mqttBroker,
    right_opts
);
let person_door_client: MqttClient = mqtt.connect(
    mqttBroker,
    person_opts
);

left_door_client.subscribe(leftCtlTopic);
clearLeftControlQueue(leftCtlTopic)
left_door_client.on("message", receiveLeftMessage);

right_door_client.subscribe(rightCtlTopic);
clearRightControlQueue(rightCtlTopic)
right_door_client.on("message", receiveRightMessage);

app.listen(3000, () => logger.info(`Garage control listening on port 3000`));
app.get("/", (req, res) => {
    return res.send({
        result: "OK",
        serverTime: new Date(Date.now()).toLocaleDateString()
    });
});
app.get("/getDoorState/:door", (req, res) => {
    var status: string = "OK";
    let state: string = "-";
    let result: any = {};
    if (req.params.door) {
        let side: string = req.params.door.toString().toLocaleLowerCase();
        switch (side) {
            case "left":
                state = DoorState[GarageState.leftDoor.state]
                    .toString()
                    .toLocaleLowerCase();
                break;
            case "right":
                state = DoorState[GarageState.rightDoor.state]
                    .toString()
                    .toLocaleLowerCase();
                break;
            case "person":
                state = DoorState[GarageState.personDoor.state]
                    .toString()
                    .toLocaleLowerCase();
                break;
        }
        result = {
            result: status,
            state: state,
            side: side
        };
    } else {
        result = {
            result: status,
            doors: [
                {
                    left: DoorState[GarageState.leftDoor.state]
                        .toString()
                        .toLocaleLowerCase()
                },
                {
                    right: DoorState[GarageState.rightDoor.state]
                        .toString()
                        .toLocaleLowerCase()
                },
                {
                    person: DoorState[GarageState.personDoor.state]
                        .toString()
                        .toLocaleLowerCase()
                }
            ]
        };
    }
    return res.send(result);
});
app.get("/getDoorState", (req, res) => {
    var status: string = "OK";
    let result: any = {};

    result = {
        result: status,
        doors: [
            {
                left: DoorState[GarageState.leftDoor.state]
                    .toString()
                    .toLocaleLowerCase()
            },
            {
                right: DoorState[GarageState.rightDoor.state]
                    .toString()
                    .toLocaleLowerCase()
            },
            {
                person: DoorState[GarageState.personDoor.state]
                    .toString()
                    .toLocaleLowerCase()
            }
        ]
    };

    return res.send(result);
});
app.get("/toggleDoor/:door", (req, res) => {
    var status: string = "Invalid Door";
    let side: string = req.params.door.toString().toLocaleLowerCase();
    if (side === "left") {
        status = "OK";
        side = side;
        logger.info("Toggling left door button via web");
        GarageState.ToggleLeftButton();
    }
    if (side === "right") {
        status = "OK";
        side = side;
        logger.info("Toggling right door button via web");
        GarageState.ToggleRightButton();
    }
    var result = {
        result: status,
        side: side
    };
    return res.send(result);
});

function garageStatusChanged(side: Side, state: DoorState) {
    let opts: IClientPublishOptions = {
        retain: true,
        qos: 1
    };
    switch (side) {
        case Side.LEFT:
            left_door_client.publish(
                leftDoorStatusTopic,
                DoorState[state].toString(),
                opts
            );
            break;
        case Side.RIGHT:
            right_door_client.publish(
                rightDoorStatusTopic,
                DoorState[state].toString(),
                opts
            );
            break;
        case Side.PERSON:
            person_door_client.publish(
                personDoorStatusTopic,
                DoorState[state].toString(),
                opts
            );
            break;
    }
}
function receiveLeftMessage(topic: string, message: Buffer) {
    if (message.toString().toLocaleLowerCase() === "toggle") {
        GarageState.ToggleLeftButton();
        logger.info("Toggling left door button via mqtt");
        clearLeftControlQueue(topic);
    }
    
}
function clearLeftControlQueue(topic: string) {
    let opts: IClientPublishOptions = {
        retain: true,
        qos: 1
    };
    left_door_client.publish(topic, "",opts);
    logger.info("Clearing left door queue");
}

function receiveRightMessage(topic: string, message: Buffer) {
    if (message.toString().toLocaleLowerCase() === "toggle") {
        GarageState.ToggleRightButton();
        logger.info("Toggling right door button via mqtt");
        clearRightControlQueue(topic);
    }
}
function clearRightControlQueue(topic: string) {
    let opts: IClientPublishOptions = {
        retain: true,
        qos: 1
    };
    right_door_client.publish(topic, "",opts);
    logger.info("Clearing right door queue");
}

