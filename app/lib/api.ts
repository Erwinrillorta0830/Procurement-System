import axios from "axios";

const API_BASE = "http://100.126.246.124:8060/items";

export const api = axios.create({
    baseURL: API_BASE,
    headers: {
        "Content-Type": "application/json",
    },
});
