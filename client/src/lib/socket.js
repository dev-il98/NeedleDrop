import { io } from "socket.io-client";
import { SERVER_URL } from "./api";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      withCredentials: true,
    });
  }
  return socket;
}
