// src/components/webrtc/FileTransfer.tsx
import React, { useRef } from 'react';
// ... (imports 基本不变) ...
import { Paper, Title, Tabs, FileInput, Button, Progress, Box, Text, Card, Anchor, Code, Stack, Badge } from '@mantine/core';
import { IconUpload, IconDownload, IconFileAnalytics, IconSend, IconFileDownload } from '@tabler/icons-react';
import { useWebRTCStore } from '../../stores/webrtcStore';

const FileTransfer: React.FC = () => {
    // 状态获取基本不变，因为这些状态的含义在 store 中没有大改
    const isP2PConnected = useWebRTCStore(state => state.isP2PConnected);
    const selectedFile = useWebRTCStore(state => state.selectedFile);
    const setSelectedFile = useWebRTCStore(state => state.setSelectedFile);
    const fileSendProgress = useWebRTCStore(state => state.fileSendProgress);
    const isFileSending = useWebRTCStore(state => state.isFileSending);
    const sendFile = useWebRTCStore(state => state.sendFile); // 这个 action 内部已适配
    const targetPeerIdForP2P = useWebRTCStore(state => state.targetPeerIdForP2P);
    const receivingFileMetadata = useWebRTCStore(state => state.receivingFileMetadata);
    const fileReceiveProgress = useWebRTCStore(state => state.fileReceiveProgress);
    const lastReceivedFileData = useWebRTCStore(state => state.lastReceivedFileData);
    const receivedFileDownloadUrl = useWebRTCStore(state => state.receivedFileDownloadUrl);
    const showStoreNotification = useWebRTCStore(state => state.showNotification);

    const receivedFileLinkAnchorRef = useRef<HTMLAnchorElement>(null);

    const handleFileSelect = (file: File | null) => {
        setSelectedFile(file);
    };

    const handleSend = async () => {
        if (!selectedFile) {
            showStoreNotification('错误', '请先选择一个文件。', 'error');
            return;
        }
        if (!isP2PConnected) { // 确保 P2P 已连接
            showStoreNotification('错误', 'P2P未连接，无法发送文件。', 'error');
            return;
        }
        await sendFile();
    };

    if (!isP2PConnected) return null; // 只有 P2P 连接后才显示

    return (
        <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Title order={3} mb="md">文件传输 (HTTP API 信令)</Title>
            <Tabs defaultValue="send">
                <Tabs.List grow>
                    <Tabs.Tab value="send" leftSection={<IconUpload size="1rem" />}>发送文件</Tabs.Tab>
                    <Tabs.Tab value="receive" leftSection={<IconDownload size="1rem" />} rightSection={lastReceivedFileData ? <Badge color="pink" variant="light" circle>新</Badge> : null}>
                        接收文件
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="send" pt="lg">
                    <Stack>
                        <FileInput
                            label="选择要发送的文件"
                            placeholder="选择或拖拽文件"
                            value={selectedFile}
                            onChange={handleFileSelect}
                            leftSection={<IconFileAnalytics size="1.2rem" />}
                            clearable
                            description={selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)` : ""}
                        />
                        <Box>
                            <Text size="xs" c="dimmed" ta="right">{fileSendProgress}%</Text>
                            <Progress value={fileSendProgress} striped={isFileSending} animated={isFileSending && fileSendProgress < 100} size="lg" radius="sm" />
                        </Box>
                        <Button
                            onClick={handleSend}
                            disabled={!selectedFile || isFileSending || !isP2PConnected} // 增加 !isP2PConnected 判断
                            loading={isFileSending}
                            leftSection={<IconSend size="1rem" />}
                            fullWidth
                        >
                            {isFileSending ? `发送中 (${fileSendProgress}%)` : `发送给 ${targetPeerIdForP2P || '目标'}`}
                        </Button>
                    </Stack>
                </Tabs.Panel>
                {/* Tabs.Panel for receive 保持不变 */}
                <Tabs.Panel value="receive" pt="lg">
                    <Stack>
                        {receivingFileMetadata && !lastReceivedFileData && (
                             <Text size="sm">正在接收: <Code>{receivingFileMetadata.name}</Code> ({fileReceiveProgress}%)</Text>
                        )}
                        <Box>
                            <Text size="xs" c="dimmed" ta="right">{fileReceiveProgress}%</Text>
                            <Progress value={fileReceiveProgress} striped={fileReceiveProgress > 0 && fileReceiveProgress < 100} animated={fileReceiveProgress > 0 && fileReceiveProgress < 100} size="xl" radius="sm" color="grape" />
                        </Box>
                        {lastReceivedFileData && receivedFileDownloadUrl && (
                            <Card withBorder p="md" radius="md" mt="md" shadow="xs">
                                <Stack>
                                    <Text fw={500}>接收完成: <Code>{lastReceivedFileData.metadata.name}</Code></Text>
                                    <Text size="xs" c="dimmed">
                                        类型: {lastReceivedFileData.metadata.type || "未知"},
                                        大小: {(lastReceivedFileData.blob.size / 1024 / 1024).toFixed(2)} MB
                                    </Text>
                                    <Anchor href={receivedFileDownloadUrl} download={lastReceivedFileData.metadata.name} mt="sm" ref={receivedFileLinkAnchorRef}>
                                        <Button leftSection={<IconFileDownload size="1rem" />} fullWidth variant="outline" color="green">
                                            下载 "{lastReceivedFileData.metadata.name}"
                                        </Button>
                                    </Anchor>
                                </Stack>
                            </Card>
                        )}
                        {!lastReceivedFileData && !receivingFileMetadata && fileReceiveProgress === 0 && (
                            <Text size="sm" ta="center" mt="lg" c="dimmed">等待接收文件...</Text>
                        )}
                    </Stack>
                </Tabs.Panel>
            </Tabs>
        </Paper>
    );
};
export default FileTransfer;