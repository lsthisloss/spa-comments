import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const fetchPosts = async (page: number, limit: number, parentId?: string) => {
  const response = await axios.get(`${API_URL}/comments`, {
    params: { page, limit, parentId }, // Передаем parentId, если он есть
  });
  return response.data;
};