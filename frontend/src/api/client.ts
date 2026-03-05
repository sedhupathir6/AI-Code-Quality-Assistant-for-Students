import axios from 'axios'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
    },
})

api.interceptors.request.use((config: any) => {
    const token = localStorage.getItem('cce_token')
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})
