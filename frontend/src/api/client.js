import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "https://api.adarshraj.in/mnemo",
  timeout: 30000,
});

// Attach token to every request automatically
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("kb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — clear storage and redirect to login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("kb_token");
      localStorage.removeItem("kb_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default client;
