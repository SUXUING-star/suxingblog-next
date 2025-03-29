// src/pages/LoginPage.tsx
import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
	Text, Container, Paper, Title, TextInput, PasswordInput, Button, Alert, Anchor, LoadingOverlay, Stack
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { LoginCredentials } from '../../types/types';

function LoginPage() {
	const { login, token, isLoading, error, clearError } = useAuth();
	const location = useLocation();
	const from = location.state?.from?.pathname || "/"; // 获取重定向来源，默认为首页

	const form = useForm<LoginCredentials>({
		initialValues: { email: '', password: '' },
		validate: {
			email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Invalid email'),
			password: (value) => (value.length >= 6 ? null : 'Password must be at least 6 characters'),
		},
	});



	const handleSubmit = async (values: LoginCredentials) => {
		console.log('LoginPage: Submitting login form'); // 调试日志
		const loginSuccess = await login(values); // 等待 login 完成
		// 这里的重定向现在依赖于组件因为 token 变化而进行的下一次渲染
		console.log('LoginPage: Login attempt result:', loginSuccess);
	};
	// --- !! 步骤 2: 将 useEffect 移到这里 !! ---
	// 确保 useEffect 在任何 return 语句之前被调用
	useEffect(() => {
		// 当表单值改变时清除错误（避免旧错误一直显示）
		clearError();
	}, [form.values.email, form.values.password, clearError]); // 依赖表单值和 clearError 函数
	// --- 步骤 3: 现在可以进行条件返回 ---
	// 如果 token 已经存在 (可能是初始加载时就有，或者登录成功后重渲染时)，则重定向
	if (token) {
		console.log(`LoginPage: Token found, navigating to ${from}`); // 调试日志
		return <Navigate to={from} replace />;
	}

	return (
		<Container size="xs" px="xs" mt="xl">
			<Paper withBorder shadow="md" p="lg" radius="md" mt="xl" pos="relative">
				{/* 加载覆盖层 */}
				<LoadingOverlay visible={isLoading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />

				<Title order={2} ta="center" mb="lg">
					登录您的账号
				</Title>

				<form onSubmit={form.onSubmit(handleSubmit)}>
					<Stack gap="md">
						{/* 显示登录错误 */}
						{error && (
							<Alert icon={<IconAlertCircle size={16} />} title="Login Failed" color="red" radius="md">
								{error}
							</Alert>
						)}

						<TextInput
							required
							label="邮箱"
							placeholder="xxx@email.com"
							{...form.getInputProps('email')}
						/>

						<PasswordInput
							required
							label="密码"
							placeholder="输入密码"
							{...form.getInputProps('password')}
						/>

						<Button type="submit" fullWidth mt="md">
							登录
						</Button>
					</Stack>
				</form>

				<Text ta="center" mt="md" size="sm">
					还没有账号？{' '}
					<Anchor component={RouterLink} to="/register" fw={500}>
						点我注册
					</Anchor>
				</Text>
			</Paper>
		</Container>
	);
}

export default LoginPage;