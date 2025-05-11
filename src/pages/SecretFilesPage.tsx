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
    Center,
} from '@mantine/core';
import { IconUpload, IconDownload, IconTrash, IconAlertCircle, IconLock, IconRefresh, IconLogout, IconFile } from '@tabler/icons-react';

const API_FILE_BASE_URL = `${import.meta.env.VITE_API_GITHUB_URL}/file`;

interface FileInfo {
    name: string; // 完整的时间戳文件名 (e.g., 1678886400000_sanitizedName.jpg), 作为 fileId
    path: string; // 完整的 GitHub 路径
    sha: string;
    size: number;
    type: 'file';
    timestamp: number;
    displayFilename: string; // 从时间戳文件名中解析出的更友好的原始文件名部分
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
    };

    useEffect(() => {
        if (operationPassword && !isOperationAuthenticated) {
            setIsOperationAuthenticated(true); // 乐观设置UI，如果fetchFiles失败会被改回来
            fetchFiles(operationPassword);
        }
    }, [operationPassword, isOperationAuthenticated]); // 添加 isOperationAuthenticated 以避免重复获取

    const handleLogout = () => {
        setOperationPassword(null);
        setIsOperationAuthenticated(false);
        setFiles([]);
        setAuthError(null);
        if (passwordInputRef.current) passwordInputRef.current.value = '';
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
        const headers: HeadersInit = { 'X-Operation-Password': operationPassword };
        const response = await fetch(`${API_FILE_BASE_URL}${endpoint}`, {
            method, headers, body: body instanceof FormData ? body : undefined,
        });
        if (response.status === 401) {
            setIsOperationAuthenticated(false); setOperationPassword(null);
            throw new Error('认证失败，请检查操作密码是否正确。');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP 错误！状态码: ${response.status}` }));
            throw new Error(errorData.message || `API 请求失败: ${response.status}`);
        }
        if (endpoint.startsWith('/download/')) { return response.blob() as Promise<T>; }
        return response.json() as Promise<T>;
    };

    const fetchFiles = async (currentPwd?: string) => {
        const pwdToUse = currentPwd || operationPassword;
        if (!pwdToUse) {
            setListError("无法获取文件列表：操作密码未设置。");
            setIsOperationAuthenticated(false);
            return;
        }
        setLoadingFiles(true); setListError(null);
        try {
            const data = await makeApiRequest<{ success: boolean; files?: FileInfo[]; message: string }>(
                '/list', 'GET'
            );
            if (data.success) {
                setFiles(data.files || []);
            } else { throw new Error(data.message || "获取文件列表失败"); }
        } catch (err: any) {
            setListError(err.message);
            if (err.message.toLowerCase().includes("认证失败")) { setIsOperationAuthenticated(false); }
            setFiles([]);
        } finally { setLoadingFiles(false); }
    };

    const handleFileChange = (selectedFile: File | null) => {
        setFileToUpload(selectedFile);
        setUploadMessage(null);
    };

    const handleUpload = async () => {
        if (!fileToUpload) { setUploadMessage({ type: 'error', text: '请先选择一个文件。' }); return; }
        setUploading(true); setUploadMessage(null);
        const formData = new FormData(); formData.append('file', fileToUpload);
        try {
            const data = await makeApiRequest<{ success: boolean; fileId?: string; downloadUrl?: string; originalFilename?: string; message: string }>(
                '/upload', 'POST', formData
            );
            if (data.success) {
                setUploadMessage({ type: 'success', text: `文件 "${data.originalFilename || fileToUpload.name}" 上传成功！ID: ${data.fileId}` });
                setFileToUpload(null); // 清空 Mantine FileInput 的值
                fetchFiles();
            } else { throw new Error(data.message || "上传失败"); }
        } catch (err: any) {
            setUploadMessage({ type: 'error', text: `上传错误: ${err.message}` });
        } finally { setUploading(false); }
    };

    const handleDownload = async (fileIdToDownload: string, filenameToSaveAs: string) => {
        // fileIdToDownload 应该是后端返回的 item.name (完整的时间戳文件名)
        // filenameToSaveAs 应该是 item.displayFilename (更友好的原始文件名部分)
        try {
            const blob = await makeApiRequest<Blob>(`/download/${fileIdToDownload}`, 'GET');
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
            a.download = filenameToSaveAs;
            document.body.appendChild(a); a.click();
            window.URL.revokeObjectURL(url); document.body.removeChild(a);
        } catch (err: any) {
            console.error('下载错误:', err);
            alert(`下载文件 "${filenameToSaveAs}" 失败: ${err.message}`);
        }
    };

    const handleDelete = async (fileIdToDelete: string, filenameForConfirm: string) => {
        // fileIdToDelete 应该是后端返回的 item.name (完整的时间戳文件名)
        // filenameForConfirm 应该是 item.displayFilename (更友好的原始文件名部分)
        if (!window.confirm(`确定要删除文件 "${filenameForConfirm}" 吗？此操作不可恢复。`)) { return; }
        try {
            const data = await makeApiRequest<{ success: boolean; message: string }>(
                `/delete/${fileIdToDelete}`, 'DELETE'
            );
            if (data.success) {
                alert(data.message || `文件 "${filenameForConfirm}" 已成功删除。`);
                fetchFiles();
            } else { throw new Error(data.message || "删除失败"); }
        } catch (err: any) { alert(`删除文件 "${filenameForConfirm}" 失败: ${err.message}`); }
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
                    <Table striped highlightOnHover withTableBorder verticalSpacing="md" >
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>文件名 (点击可复制完整ID)</Table.Th>
                                <Table.Th style={{ textAlign: 'right', width: '120px' }}>大小</Table.Th>
                                <Table.Th style={{ textAlign: 'center', width: '130px' }}>操作</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {files.map((f) => (
                                <Table.Tr key={f.sha || f.name}> {/* 仍然建议用 f.name (即fileId) 或 f.path 作为key */}
                                    <Table.Td style={{ wordBreak: 'break-all', maxWidth: 'calc(100vw - 320px)' }}> {/* 调整了maxWidth */}
                                        <Tooltip label={`完整ID: ${f.name} (点击复制)`} openDelay={500} withArrow multiline >
                                            <Text
                                                truncate="end"
                                                onClick={() => navigator.clipboard.writeText(f.name).then(() => alert('完整文件名已复制到剪贴板!')).catch(err => console.error('复制失败', err))}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {f.displayFilename} {/* 显示解析后的友好文件名 */}
                                            </Text>
                                        </Tooltip>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: 'right' }}>{(f.size / 1024).toFixed(2)} KB</Table.Td>
                                    <Table.Td>
                                        <Group justify="center" gap="sm" wrap="nowrap">
                                            <Tooltip label="下载文件">
                                                <ActionIcon
                                                    variant="light"
                                                    color="blue"
                                                    onClick={() => handleDownload(f.name, f.displayFilename)}  // 下载时用 f.name (fileId), 保存时用 f.displayFilename
                                                    size="lg"
                                                >
                                                    <IconDownload stroke={1.5} />
                                                </ActionIcon>
                                            </Tooltip>
                                            <Tooltip label="删除文件">
                                                <ActionIcon
                                                    variant="light"
                                                    color="red"
                                                    onClick={() => handleDelete(f.name, f.displayFilename)} // 删除时用 f.name (fileId), 确认时用 f.displayFilename
                                                    size="lg"
                                                >
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