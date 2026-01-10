import axios from 'axios';
// URL-ul backend-ului (Gateway)
// Dacă rulezi în Docker, localhost e ok pentru browser
const BASE_URL = "http://localhost:8000"; 

export const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});