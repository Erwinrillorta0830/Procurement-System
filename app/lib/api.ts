import axios from "axios";

const api = axios.create({
    baseURL: "http://100.119.3.44:8055/items",
    headers: { "Content-Type": "application/json" },
});

export default api;
