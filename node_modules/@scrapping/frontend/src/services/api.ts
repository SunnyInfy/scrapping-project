import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const fetchResults = async (motive: string) => {
  const response = await api.get(`/results/${motive}`);
  return response.data.data;
};

export const fetchStatus = async (motive: string) => {
  const response = await api.get(`/status/${motive}`);
  return response.data;
};

export const triggerScrape = async (motive: string, source: string, url: string) => {
  const response = await api.post(`/scrape/${motive}/${source}`, { url });
  return response.data;
};
