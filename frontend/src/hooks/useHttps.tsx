import axios from "axios";
export const rootApiUrl ="http://localhost:9002/api"; // 
export const aiUrl = "http://localhost:9002/face";
export const imgUrl = "http://localhost:9002/public/" 
export const BaseUrl = "http://localhost:9002"

const useHttps = () => {
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

  const aiFileHttp = axios.create({
    baseURL: aiUrl,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return {
    http,
    fileHttp,
    aiFileHttp,
  };
};

export default useHttps;