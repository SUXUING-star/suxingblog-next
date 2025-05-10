// src/components/webrtc/SignalingControl.tsx
import React, { useState } from 'react';
import {
    Paper,
    Title,
    TextInput,
    Button,
    Group,
    Text,
    Code,
    Badge,
    Tooltip,
    ThemeIcon,
    Box,
    Loader,
    useMantineTheme
} from '@mantine/core';
import { IconLink, IconUnlink, IconUsers, IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useWebRTCStore } from '../../stores/webrtcStore'; // 确保路径正确
import PopOverCopyButton from './PopOverCopyButton'; // 假设 PopOverCopyButton 在同一目录或正确路径

const SignalingControl: React.FC = () => {
    const theme = useMantineTheme();

    // MODIFIED: 从 Zustand store 单独获取每个需要的状态和 action
    const isSignalConnecting = useWebRTCStore(state => state.isSignalConnecting);
    const isSignalConnected = useWebRTCStore(state => state.isSignalConnected);
    const myClientId = useWebRTCStore(state => state.myClientId);
    const currentSignalRoomId = useWebRTCStore(state => state.currentSignalRoomId);
    const connectToSignaling = useWebRTCStore(state => state.connectToSignaling); // Action 引用是稳定的
    const disconnectFromSignaling = useWebRTCStore(state => state.disconnectFromSignaling); // Action 引用是稳定的
    // 如果需要从这里触发通知，也可以获取 showNotification action
    // const showStoreNotification = useWebRTCStore(state => state.showNotification);

    // 本地状态，仅用于房间 ID 输入框
    const [roomIdInput, setRoomIdInput] = useState<string>('P2P文件共享室');

    const handleToggleConnection = () => {
        if (isSignalConnected) {
            disconnectFromSignaling('用户手动操作');
        } else {
            if (roomIdInput.trim()) {
                connectToSignaling(roomIdInput.trim());
            } else {
                // 可以调用 store 的 showNotification，或者有本地错误提示
                // 例如: showStoreNotification('错误', '请输入房间 ID。', 'error');
                // 或者，如果通知主要在 SignalTestPage 处理，这里可以不直接调用
                alert('请输入房间 ID。'); // 简单 alert 作为临时替代
            }
        }
    };

    return (
        <Paper shadow="md" p="xl" radius="md" withBorder>
            <Group justify="space-between" align="center" mb="lg">
                <Title order={2} c={theme.primaryColor}>信令服务器</Title>
                <Tooltip
                    label={isSignalConnected ? "信令已连接" : (isSignalConnecting ? "信令连接中..." : "信令已断开")}
                    position="left"
                    withArrow
                >
                    <Box component="span"> {/* Tooltip 子元素包裹 */}
                        <ThemeIcon size="lg" radius="xl" color={isSignalConnected ? 'teal' : (isSignalConnecting ? 'yellow' : 'red')}>
                            {isSignalConnecting ? <Loader size="1.1rem" color="white" /> : (isSignalConnected ? <IconWifi size="1.4rem" /> : <IconWifiOff size="1.4rem" />)}
                        </ThemeIcon>
                    </Box>
                </Tooltip>
            </Group>
            <TextInput
                label="房间 ID"
                placeholder="输入房间名加入或创建..."
                value={roomIdInput}
                onChange={(event) => setRoomIdInput(event.currentTarget.value)}
                disabled={isSignalConnected || isSignalConnecting}
                leftSection={<IconUsers size="1rem" />}
                mb="md"
            />
            <Button
                onClick={handleToggleConnection}
                leftSection={isSignalConnected ? <IconUnlink size="1rem" /> : <IconLink size="1rem" />}
                color={isSignalConnected ? 'orange' : 'blue'}
                fullWidth
                loading={isSignalConnecting}
            >
                {isSignalConnected ? '断开连接' : (isSignalConnecting ? '连接中...' : '连接')}
            </Button>
            {myClientId && (
                <Group mt="md" align="center">
                    <Text size="sm">我的客户端 ID:</Text>
                    <Code color="blue" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={myClientId}>
                        {myClientId}
                    </Code>
                    <PopOverCopyButton value={myClientId} />
                </Group>
            )}
            {currentSignalRoomId && (
                <Group mt="xs" gap="xs" align="center"> {/* 使用 Group 包裹 Text 和 Badge */}
                    <Text size="sm">当前房间:</Text>
                    <Badge color="grape" variant="light">{currentSignalRoomId}</Badge>
                </Group>
            )}
        </Paper>
    );
};

export default SignalingControl;