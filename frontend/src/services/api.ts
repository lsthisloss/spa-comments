import axios from 'axios';
import { Comment } from '../types/comment';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const fetchComments = async (): Promise<Comment[]> => {
  const response = await axios.get(`${API_URL}/comments`);
  return response.data;
};

export const addComment = async (comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> => {
  const response = await axios.post(`${API_URL}/comments`, comment);
  return response.data;
};