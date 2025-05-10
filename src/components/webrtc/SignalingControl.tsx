// src/components/webrtc/SignalingControl.tsx
import React, { useState, useEffect } from 'react'; // useEffect for initial join attempt
import {
    Paper, Title, TextInput, Button, Group, Text, Code, Badge,
    Tooltip, ThemeIcon, Box, Loader, useMantineTheme
} from '@mantine/core';
import { IconLink, IconUnlink, IconUsers, IconWifi, IconWifiOff } from '@tabler/icons-react';
import { useWebRTCStore } from '../../stores/webrtcStore'; // 确保路径正确
import PopOverCopyButton from './PopOverCopyButton';

const SignalingControl: React.FC = () => {
    const theme = useMantineTheme();

    // MODIFIED: 获取新的状态和 actions
    const isSignalSetup = useWebRTCStore(state => state.isSignalSetup);
    const isConnectingOrJoining = useWebRTCStore(state => state.isConnectingOrJoining);
    const myClientId = useWebRTCStore(state => state.myClientId);
    const currentRoomId = useWebRTCStore(state => state.currentRoomId);
    const joinRoomAndSetupSignaling = useWebRTCStore(state => state.joinRoomAndSetupSignaling);
    const leaveRoom = useWebRTCStore(state => state.leaveRoom);
    const showStoreNotification = useWebRTCStore(state => state.showNotification); // 用于显示错误

    const [roomIdInput, setRoomIdInput] = useState<string>('P2P文件共享室'); // 本地输入状态

    const handleToggleConnection = async () => {
        if (isSignalSetup) {
            await leaveRoom();
        } else {
            if (roomIdInput.trim()) {
                const success = await joinRoomAndSetupSignaling(roomIdInput.trim());
                if (!success) {
                    // store 内部的 joinRoomAndSetupSignaling 失败时会调用 showNotification
                    // 这里可以不用重复提示，或者根据需要添加特定于UI的反馈
                }
            } else {
                showStoreNotification('输入错误', '请输入有效的房间 ID。', 'error');
            }
        }
    };

    // 可选：如果希望组件加载时自动尝试加入一个默认房间（如果之前有状态）
    // 或者如果 store 中已有 roomId 但未 setup，可以尝试自动加入
    // useEffect(() => {
    //     const initialRoomId = useWebRTCStore.getState().currentRoomId || roomIdInput;
    //     if (initialRoomId && !useWebRTCStore.getState().isSignalSetup && !useWebRTCStore.getState().isConnectingOrJoining) {
    //         console.log(`[SignalingControl] Attempting to auto-join room: ${initialRoomId}`);
    //         joinRoomAndSetupSignaling(initialRoomId);
    //     }
    // }, [joinRoomAndSetupSignaling, roomIdInput]);


    return (
        <Paper shadow="md" p="xl" radius="md" withBorder>
            <Group justify="space-between" align="center" mb="lg">
                <Title order={2} c={theme.primaryColor}>信令设置 (HTTP API)</Title>
                <Tooltip
                    label={isSignalSetup ? "已加入房间" : (isConnectingOrJoining ? "加入中..." : "未加入房间")}
                    position="left"
                    withArrow
                >
                    <Box component="span">
                        <ThemeIcon size="lg" radius="xl" color={isSignalSetup ? 'teal' : (isConnectingOrJoining ? 'yellow' : 'red')}>
                            {isConnectingOrJoining ? <Loader size="1.1rem" color="white" /> : (isSignalSetup ? <IconWifi size="1.4rem" /> : <IconWifiOff size="1.4rem" />)}
                        </ThemeIcon>
                    </Box>
                </Tooltip>
            </Group>
            <TextInput
                label="房间 ID"
                placeholder="输入房间名加入或创建..."
                value={roomIdInput}
                onChange={(event) => setRoomIdInput(event.currentTarget.value)}
                disabled={isSignalSetup || isConnectingOrJoining} // 如果已设置或正在加入，则禁用输入
                leftSection={<IconUsers size="1rem" />}
                mb="md"
            />
            <Button
                onClick={handleToggleConnection}
                leftSection={isSignalSetup ? <IconUnlink size="1rem" /> : <IconLink size="1rem" />}
                color={isSignalSetup ? 'orange' : 'blue'}
                fullWidth
                loading={isConnectingOrJoining}
            >
                {isSignalSetup ? '离开房间' : (isConnectingOrJoining ? '处理中...' : '加入房间')}
            </Button>
            {myClientId && isSignalSetup && ( // 只在成功设置后显示
                <Group mt="md" align="center">
                    <Text size="sm">我的客户端 ID:</Text>
                    <Code color="blue" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={myClientId}>
                        {myClientId}
                    </Code>
                    <PopOverCopyButton value={myClientId} />
                </Group>
            )}
            {currentRoomId && isSignalSetup && ( // 只在成功设置后显示
                <Group mt="xs" gap="xs" align="center">
                    <Text size="sm">当前房间:</Text>
                    <Badge color="grape" variant="light">{currentRoomId}</Badge>
                </Group>
            )}
        </Paper>
    );
};
export default SignalingControl;