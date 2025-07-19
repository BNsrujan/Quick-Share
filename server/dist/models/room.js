"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iceCandidateSchema = exports.answerSchema = exports.offerSchema = exports.joinRoomSchema = exports.createRoomSchema = exports.RoomStatus = void 0;
const zod_1 = require("zod");
// Room status enum
var RoomStatus;
(function (RoomStatus) {
    RoomStatus["WAITING"] = "waiting";
    RoomStatus["CONNECTED"] = "connected";
    RoomStatus["TRANSFERRING"] = "transferring";
    RoomStatus["COMPLETED"] = "completed";
    RoomStatus["EXPIRED"] = "expired";
})(RoomStatus || (exports.RoomStatus = RoomStatus = {}));
// Room creation input validation schema
exports.createRoomSchema = zod_1.z.object({
    metadata: zod_1.z.object({
        fileName: zod_1.z.string().optional(),
        fileSize: zod_1.z.number().optional(),
        fileType: zod_1.z.string().optional()
    }).optional()
});
// Room join input validation schema
exports.joinRoomSchema = zod_1.z.object({
    code: zod_1.z.string().min(6).max(10),
    peerId: zod_1.z.string()
});
// WebRTC signaling schemas
exports.offerSchema = zod_1.z.object({
    roomId: zod_1.z.string(),
    offer: zod_1.z.any()
});
exports.answerSchema = zod_1.z.object({
    roomId: zod_1.z.string(),
    answer: zod_1.z.any()
});
exports.iceCandidateSchema = zod_1.z.object({
    roomId: zod_1.z.string(),
    candidate: zod_1.z.any()
});
