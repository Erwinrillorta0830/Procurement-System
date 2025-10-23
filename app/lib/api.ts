import axios from "axios";

const API_BASE = "http://100.119.3.44:8055/items";

export const api = axios.create({
    baseURL: API_BASE,
    headers: {
        "Content-Type": "application/json",
    },
});
