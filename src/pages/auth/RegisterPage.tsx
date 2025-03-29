// src/pages/RegisterPage.tsx
import React, { useEffect , useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container, Paper, Title, TextInput, PasswordInput, Button, Alert, Anchor, LoadingOverlay, Stack, Text
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { RegisterCredentials } from '../../types/types';

function RegisterPage() {
  const { register, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const form = useForm<RegisterCredentials>({
    initialValues: { name: '', email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Invalid email'),
      password: (value) => (value.length >= 6 ? null : 'Password must be at least 6 characters'),
      name: (value) => (value && value.trim().length > 0 ? null : 'Name is required'), // 假设 name 必填
    },
  });

  const handleSubmit = async (values: RegisterCredentials) => {
    setRegisterSuccess(false); // 重置成功状态
    const success = await register(values);
    if (success) {
        setRegisterSuccess(true);
        form.reset(); // 清空表单
        // 可以选择几秒后重定向到登录页
        setTimeout(() => navigate('/login'), 3000);
    }
    // 失败信息由 useAuth 的 error 状态显示
  };

   // 当表单值改变时清除错误
   useEffect(() => {
      if (!registerSuccess) { // 仅在非成功状态下清除
          clearError();
      }
   }, [form.values.name, form.values.email, form.values.password, clearError, registerSuccess]);


  return (
     <Container size="xs" px="xs" mt="xl">
      <Paper withBorder shadow="md" p="lg" radius="md" mt="xl" pos="relative">
         <LoadingOverlay visible={isLoading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />

        <Title order={2} ta="center" mb="lg">
          Create Your Account
        </Title>

         {/* 显示注册成功消息 */}
        {registerSuccess && (
             <Alert icon={<IconCheck size={16} />} title="Registration Successful!" color="teal" radius="md" mb="md">
                You can now log in with your credentials. Redirecting to login page...
            </Alert>
        )}

        {/* 显示注册错误消息 (仅当未显示成功消息时) */}
        {error && !registerSuccess && (
             <Alert icon={<IconAlertCircle size={16} />} title="Registration Failed" color="red" radius="md" mb="md">
                {error}
            </Alert>
        )}

        {/* 隐藏表单如果注册成功 */}
        {!registerSuccess && (
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                    <TextInput
                    required
                    label="Name"
                    placeholder="Your name"
                    {...form.getInputProps('name')}
                    />
                    <TextInput
                    required
                    label="Email"
                    placeholder="your@email.com"
                    {...form.getInputProps('email')}
                    />
                    <PasswordInput
                    required
                    label="Password"
                    placeholder="Choose a password (min. 6 characters)"
                    {...form.getInputProps('password')}
                    />
                    <Button type="submit" fullWidth mt="md">
                    Register
                    </Button>
                </Stack>
            </form>
        )}


         <Text ta="center" mt="md" size="sm">
             Already have an account?{' '}
             <Anchor component={RouterLink} to="/login" fw={500}>
                 Login here
            </Anchor>
        </Text>
      </Paper>
    </Container>
  );
}

export default RegisterPage;