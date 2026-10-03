import { fileHttp, http } from '../api/client'

// The instances live in src/api/client.ts (auth header, error mapping); kept here for existing imports.
export { BaseUrl, fileHttp, http, imgUrl, rootApiUrl } from '../api/client'

const useHttps = () => {
  return {
    http,
    fileHttp,
  }
}

export default useHttps
