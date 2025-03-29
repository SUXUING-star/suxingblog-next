// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import PostDetailPage from './pages/PostDetailPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import NotFoundPage from './pages/NotFoundPage'; // <-- 导入 404 页面

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout 嵌套路由 */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="posts/:slug" element={<PostDetailPage />} />
          {/* 其他需要 Layout 的页面放这里 */}
          {/* 例如: <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> */}
        </Route>

        {/* 独立页面 (不需要 Layout) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* --- 404 路由规则 --- */}
        {/* 使用 path="*" 匹配所有未匹配到的路径 */}
        {/* 把它放在最后！路由匹配是按顺序来的 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;