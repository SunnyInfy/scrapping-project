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

export const triggerScrape = async (motive: string, source: string, url: string, force = false) => {
  const response = await api.post(`/scrape/${motive}/${source}`, { url, force });
  return response.data;
};

export const fetchHistory = async (motive: string) => {
  const response = await api.get(`/history/${motive}`);
  return response.data;
};

export const deleteHistoryItem = async (motive: string, filename: string) => {
  const response = await api.delete(`/history/${motive}/${filename}`);
  return response.data;
};

export const fetchHistoryData = async (motive: string, filename: string) => {
  const response = await api.get(`/history/${motive}/${filename}/data`);
  return response.data.data;
};

export const fetchSources = async (motive: string) => {
  const response = await api.get(`/sources/${motive}`);
  return response.data as Array<{ id: string; label: string; hint: string; exampleUrl: string }>;
};
