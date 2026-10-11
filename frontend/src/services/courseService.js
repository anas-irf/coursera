// frontend/src/services/courseService.js
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const courseService = {
  // Get all courses for the instructor
  getInstructorCourses: async () => {
   try {
     const response = await axiosInstance.get('/courses/instructor/');
     return response.data;
   } catch (error) {
     console.error('Error fetching instructor courses:', error);
     return [];
   }
 },

 // Get instructor analytics
 getInstructorAnalytics: async () => {
   try {
     const response = await axiosInstance.get('/analytics/instructor/');
     return response.data;
   } catch (error) {
     console.error('Error fetching analytics:', error);
     return null;
   }
 },

 // Create a new course
 createCourse: async (courseData) => {
   try {
     const response = await axiosInstance.post('/courses/', courseData);
     return response.data;
   } catch (error) {
     throw error;
   }
 },

 // Update course
 updateCourse: async (courseId, courseData) => {
   try {
     const response = await axiosInstance.put(`/courses/${courseId}/`, courseData);
     return response.data;
   } catch (error) {
     throw error;
   }
 },

 // Delete course
 deleteCourse: async (courseId) => {
   try {
     await axiosInstance.delete(`/courses/${courseId}/`);
     return true;
   } catch (error) {
     throw error;
   }
 },

 // Get course details
 getCourseDetails: async (courseId) => {
   try {
     const response = await axiosInstance.get(`/courses/${courseId}/`);
     return response.data;
   } catch (error) {
     throw error;
   }
 },

 // Get students for a course
 getCourseStudents: async (courseId) => {
   try {
     const response = await axiosInstance.get(`/courses/${courseId}/students/`);
     return response.data;
   } catch (error) {
     console.error('Error fetching course students:', error);
     return [];
   }
 },

 // Get all students for instructor
 getInstructorStudents: async () => {
   try {
     const response = await axiosInstance.get('/courses/instructor/courses/students/');
     return response.data;
   } catch (error) {
     console.error('Error fetching instructor students:', error);
     return [];
   }
 },

 // Upload course content
 uploadContent: async (courseId, formData) => {
   try {
     const response = await axiosInstance.post(
       `/courses/${courseId}/content/`,
       formData,
       {
         headers: {
           'Content-Type': 'multipart/form-data',
         },
       }
     );
     return response.data;
   } catch (error) {
     throw error;
   }
 },

 // Get instructor earnings
 getEarnings: async (period = '30days') => {
   try {
     const response = await axiosInstance.get(`/earnings/?period=${period}`);
     return response.data;
   } catch (error) {
     console.error('Error fetching earnings:', error);
     return null;
   }
 }
};

export default courseService;