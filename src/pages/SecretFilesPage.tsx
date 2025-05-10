import React, { useState, useEffect, ChangeEvent, FormEvent, useRef } from 'react';
import {
    Container,
    Title,
    PasswordInput,
    Button,
    Stack,
    FileInput,
    Table,
    ActionIcon,
    Text,
    Group,
    Loader,
    Alert,
    Paper,
    Divider,
    Tooltip,
    Center, // 用于居中加载和空状态
} from '@mantine/core';
import { IconUpload, IconDownload, IconTrash, IconAlertCircle, IconLock, IconRefresh, IconLogout, IconFile } from '@tabler/icons-react';

// 从 Vite 环境变量获取 API 基础 URL
const API_FILE_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/file`; // 确保 VITE_API_BASE_URL 后面没有 /file

interface FileInfo {
    name: string;
    path: string; // 通常是 name，因为它们在 temp_uploads 下
    size: number;
    sha: string;
}

const SecretFilesPage: React.FC = () => {
    const [operationPassword, setOperationPassword] = useState<string | null>(null);
    const [isOperationAuthenticated, setIsOperationAuthenticated] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [files, setFiles] = useState<FileInfo[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [listError, setListError] = useState<string | null>(null);

    const handleOperationAuth = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        const pwd = passwordInputRef.current?.value;

        if (!pwd) {
            setAuthError('密码不能为空。');
            return;
        }
        setAuthError(null);
        setOperationPassword(pwd);
        // useEffect 会在 operationPassword 更新后调用 fetchFiles
    };

    useEffect(() => {
        if (operationPassword && !isOperationAuthenticated) { // 只有在密码被设置且之前未认证时才自动获取
            setIsOperationAuthenticated(true);
            fetchFiles(operationPassword);
        }
    }, [operationPassword]);


    const handleLogout = () => {
        setOperationPassword(null);
        setIsOperationAuthenticated(false);
        setFiles([]);
        setAuthError(null);
        if (passwordInputRef.current) passwordInputRef.current.value = ''; // 清空密码框
    };

    const makeApiRequest = async <T,>(
        endpoint: string,
        method: 'GET' | 'POST' | 'DELETE' = 'GET',
        body?: FormData | null,
    ): Promise<T> => {
        if (!operationPassword) {
            setIsOperationAuthenticated(false);
            throw new Error('操作密码未设置，请重新认证。');
        }

        const headers: HeadersInit = {
            'X-Operation-Password': operationPassword,
        };
        // FormData 会自动设置 Content-Type，所以不需要显式设置
        // 对于其他请求，如果 body 不是 FormData 且有内容，可以默认 'application/json'
        // 但我们的上传是 FormData，下载是 GET，列表是 GET，删除是 DELETE 无 body

        const response = await fetch(`${API_FILE_BASE_URL}${endpoint}`, {
            method,
            headers,
            body: body instanceof FormData ? body : undefined, // DELETE 请求不应该有 body
        });

        if (response.status === 401) {
            setIsOperationAuthenticated(false);
            setOperationPassword(null); // 清除无效密码
            throw new Error('认证失败，请检查操作密码是否正确。');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP 错误！状态码: ${response.status}` }));
            throw new Error(errorData.message || `API 请求失败: ${response.status}`);
        }

        if (endpoint.startsWith('/download/')) {
            return response.blob() as Promise<T>;
        }
        return response.json() as Promise<T>;
    };

    const fetchFiles = async (currentPwd?: string) => {
        const pwdToUse = currentPwd || operationPassword;
        if (!pwdToUse) {
            setListError("无法获取文件列表：操作密码未设置。");
            setIsOperationAuthenticated(false);
            return;
        }

        setLoadingFiles(true);
        setListError(null);
        try {
            const data = await makeApiRequest<{ success: boolean; files?: FileInfo[]; message: string }>(
                '/list', 'GET'
            );
            if (data.success) {
                setFiles(data.files || []);
            } else {
                throw new Error(data.message || "获取文件列表失败");
            }
        } catch (err: any) {
            setListError(err.message);
            if (err.message.toLowerCase().includes("认证失败")) {
                setIsOperationAuthenticated(false);
            }
            setFiles([]);
        } finally {
            setLoadingFiles(false);
        }
    };

    const handleFileChange = (selectedFile: File | null) => {
        setFileToUpload(selectedFile);
        setUploadMessage(null);
    };

    const handleUpload = async () => {
        if (!fileToUpload) {
            setUploadMessage({ type: 'error', text: '请先选择一个文件。' });
            return;
        }
        setUploading(true);
        setUploadMessage(null);
        const formData = new FormData();
        formData.append('file', fileToUpload);

        try {
            const data = await makeApiRequest<{ success: boolean; fileId?: string; downloadUrl?: string; message: string }>(
                '/upload', 'POST', formData
            );
            if (data.success) {
                setUploadMessage({ type: 'success', text: `文件 "${fileToUpload.name}" 上传成功！ID: ${data.fileId}` });
                setFileToUpload(null); // 清空已选择的文件
                if (passwordInputRef.current) passwordInputRef.current.value = ''; // 清空文件输入框视觉残留
                fetchFiles(); // 重新加载文件列表
            } else {
                throw new Error(data.message || "上传失败");
            }
        } catch (err: any) {
            setUploadMessage({ type: 'error', text: `上传错误: ${err.message}` });
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = async (fileId: string, filename: string) => {
        try {
            const blob = await makeApiRequest<Blob>(`/download/${fileId}`, 'GET');
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err: any) {
            console.error('下载错误:', err);
            alert(`下载文件 "${filename}" 失败: ${err.message}`);
        }
    };

    const handleDelete = async (fileId: string, filename: string) => {
        if (!window.confirm(`确定要删除文件 "${filename}" 吗？此操作不可恢复。`)) {
            return;
        }
        try {
            const data = await makeApiRequest<{ success: boolean; message: string }>(
                `/delete/${fileId}`, 'DELETE'
            );
            if (data.success) {
                alert(data.message || `文件 "${filename}" 已成功删除。`);
                fetchFiles();
            } else {
                throw new Error(data.message || "删除失败");
            }
        } catch (err: any) {
            alert(`删除文件 "${filename}" 失败: ${err.message}`);
        }
    };


    if (!isOperationAuthenticated) {
        return (
            <Container size="xs" style={{ paddingTop: '5vh', paddingBottom: '5vh' }}>
                <Paper withBorder shadow="md" p="xl" radius="md">
                    <Center>
                        <IconLock size="2.5rem" stroke={1.5} style={{ marginBottom: '1rem' }} />
                    </Center>
                    <Title order={3} ta="center" mb="lg">秘密文件保险箱</Title>
                    <form onSubmit={handleOperationAuth}>
                        <Stack>
                            <PasswordInput
                                ref={passwordInputRef}
                                required
                                label="操作密码"
                                placeholder="请输入您的操作密码"
                                error={authError}
                                description="此密码用于所有文件操作的授权"
                                size="md"
                            />
                            <Button type="submit" mt="md" fullWidth size="md">授权访问</Button>
                        </Stack>
                    </form>
                </Paper>
            </Container>
        );
    }

    return (
        <Container size="xl" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
            <Group justify="space-between" align="center" mb="xl">
                <Title order={2}><IconFile size="1.8rem" style={{ marginRight: '0.5rem', verticalAlign: 'bottom' }} />GitHub个人云盘</Title>
                <Tooltip label="锁定页面并清除会话">
                    <Button onClick={handleLogout} color="orange" variant="outline" leftSection={<IconLogout size="1rem" />}>
                        锁定
                    </Button>
                </Tooltip>
            </Group>

            <Paper withBorder shadow="sm" p="lg" mb="xl" radius="md">
                <Title order={4} mb="md">上传新文件</Title>
                <Stack>
                    <FileInput
                        label="选择文件"
                        placeholder="点击选择或拖拽文件到此处"
                        value={fileToUpload}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt,.md,video/*,audio/*"
                        clearable
                        size="md"
                    />
                    {uploadMessage && (
                        <Alert
                            icon={<IconAlertCircle size="1.2rem" />}
                            title="上传状态"
                            color={uploadMessage.type === 'error' ? "red" : "green"}
                            withCloseButton
                            onClose={() => setUploadMessage(null)}
                            mt="sm"
                            radius="sm"
                        >
                            {uploadMessage.text}
                        </Alert>
                    )}
                    <Button
                        onClick={handleUpload}
                        loading={uploading}
                        leftSection={<IconUpload size="1rem" />}
                        mt="xs"
                        disabled={!fileToUpload || uploading}
                        size="md"
                    >
                        开始上传
                    </Button>
                </Stack>
            </Paper>

            <Divider my="xl" label="已上传文件列表" labelPosition="center" />

            <Group justify="flex-end" mb="md">
                <Button onClick={() => fetchFiles()} loading={loadingFiles} variant="light" leftSection={<IconRefresh size="1rem" />}>
                    刷新列表
                </Button>
            </Group>

            {loadingFiles && <Center mt="xl"><Loader size="xl" type="dots" /></Center>}
            {listError && (
                <Alert icon={<IconAlertCircle size="1.2rem" />} title="加载文件列表出错" color="red" mt="md" variant="filled" radius="sm">
                    {listError}
                </Alert>
            )}
            {!loadingFiles && !listError && files.length === 0 && (
                <Center mt="xl" style={{ flexDirection: 'column' }}>
                    <IconFile size="3rem" stroke={1} color="var(--mantine-color-gray-5)" />
                    <Text ta="center" mt="md" c="dimmed" size="lg">您的云盘还是空的，快上传些宝贝吧！</Text>
                </Center>
            )}
            {!loadingFiles && !listError && files.length > 0 && (
                <Paper withBorder radius="md" shadow="xs" mt="md">
                    <Table striped highlightOnHover withTableBorder verticalSpacing="md">
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>文件名</Table.Th>
                                <Table.Th style={{ textAlign: 'right', width: '120px' }}>大小</Table.Th>
                                <Table.Th style={{ textAlign: 'center', width: '120px' }}>操作</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {files.map((f) => (
                                <Table.Tr key={f.path}>
                                    <Table.Td style={{ wordBreak: 'break-all', maxWidth: 'calc(100vw - 300px)' }}>
                                        <Tooltip label={f.name} openDelay={500} withArrow>
                                            <Text truncate="end">{f.name}</Text>
                                        </Tooltip>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: 'right' }}>
                                        {(f.size / 1024).toFixed(2)} KB
                                    </Table.Td>
                                    <Table.Td>
                                        <Group justify="center" gap="sm" wrap="nowrap">
                                            <Tooltip label="下载文件">
                                                <ActionIcon variant="light" color="blue" onClick={() => handleDownload(f.name, f.name)} size="lg">
                                                    <IconDownload stroke={1.5} />
                                                </ActionIcon>
                                            </Tooltip>
                                            <Tooltip label="删除文件">
                                                <ActionIcon variant="light" color="red" onClick={() => handleDelete(f.name, f.name)} size="lg">
                                                    <IconTrash stroke={1.5} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Paper>
            )}
        </Container>
    );
};

export default SecretFilesPage;