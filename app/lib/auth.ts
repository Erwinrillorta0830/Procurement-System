export const getCurrentUser = () => {
    if (typeof window !== 'undefined') {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }
    return null;
};

export const logout = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
};
