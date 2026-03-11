import axios from "axios";

const API_BASE = "http://100.110.197.61:8091/items";

export const api = axios.create({
    baseURL: API_BASE,
    headers: {
        "Content-Type": "application/json",
    },
});
