export const getToken = () => localStorage.getItem('access_token');
export const setToken = (token: string) => localStorage.setItem('access_token', token);
export const removeToken = () => localStorage.removeItem('access_token');
export const isLoggedIn = () => !!getToken();

export const logout = () => {
  removeToken();
  window.location.href = '/login';
};
