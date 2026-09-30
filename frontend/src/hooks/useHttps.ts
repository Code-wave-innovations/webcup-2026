import axios from "axios";
// Fall back to the local backend when a variable is missing from .env
export const BaseUrl = import.meta.env.VITE_BASE_URL || "http://localhost:9002"
export const rootApiUrl = import.meta.env.VITE_API_URL || `${BaseUrl}/api`
export const imgUrl = import.meta.env.VITE_IMG_URL || `${BaseUrl}/public/`

// Created once at module level so the instances are stable across renders
// (safe to use as useEffect dependencies)
const http = axios.create({
  baseURL: rootApiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

const fileHttp = axios.create({
  baseURL: rootApiUrl,
  headers: {
    "Content-Type": "multipart/form-data",
  },
});

const useHttps = () => {
  return {
    http,
    fileHttp
  };
};

export default useHttps;
