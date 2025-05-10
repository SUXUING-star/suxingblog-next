// src/components/webrtc/P2PControl.tsx
import React from 'react';
import { Paper, Title, Text, Button, Group, List, ThemeIcon, Box, Badge, Code, useMantineTheme } from '@mantine/core';
import { IconUserCircle, IconTargetArrow, IconPhoneCall, IconPhoneOff, IconCheck } from '@tabler/icons-react';
import { useWebRTCStore } from '../../stores/webrtcStore';

const P2PControl: React.FC = () => {
    const theme = useMantineTheme();

    // MODIFIED: isSignalConnected -> isSignalSetup
    const isSignalSetup = useWebRTCStore(state => state.isSignalSetup);
    const peersInSignalRoom = useWebRTCStore(state => state.peersInSignalRoom);
    const targetPeerIdForP2P = useWebRTCStore(state => state.targetPeerIdForP2P);
    const setTargetPeerIdForP2P = useWebRTCStore(state => state.setTargetPeerIdForP2P);
    const initiateP2PCall = useWebRTCStore(state => state.initiateP2PCall);
    const isP2PConnected = useWebRTCStore(state => state.isP2PConnected);
    const closeP2PConnection = useWebRTCStore(state => state.closeP2PConnection);
    const myClientId = useWebRTCStore(state => state.myClientId);
    const showStoreNotification = useWebRTCStore(state => state.showNotification);


    const handleTargetSelect = (peerId: string) => {
        if (targetPeerIdForP2P !== peerId) {
            setTargetPeerIdForP2P(peerId);
        } else {
            setTargetPeerIdForP2P(null);
        }
    };

    const handleInitiateCall = () => {
        if (!myClientId) {
            showStoreNotification('错误', '客户端ID未设置，无法发起呼叫。', 'error');
            return;
        }
        if (targetPeerIdForP2P) {
            initiateP2PCall(targetPeerIdForP2P);
        } else {
            showStoreNotification('提示', '请先选择一个P2P目标。', 'info');
        }
    };

    const availablePeers = peersInSignalRoom.filter(id => id !== myClientId);

    // MODIFIED: 使用 isSignalSetup
    if (!isSignalSetup) return null;

    return (
        <Paper shadow="sm" p="lg" radius="md" withBorder>
            <Title order={3} mb="md">P2P 连接</Title>
            <Text size="sm" mb="xs">房间内其他 Peer ({availablePeers.length}):</Text>
            {availablePeers.length > 0 ? (
                <List spacing="xs" size="sm" center icon={<ThemeIcon color={theme.primaryColor} size={20} radius="xl"><IconUserCircle size="0.9rem" /></ThemeIcon>} mb="md">
                    {availablePeers.map(peerId => (
                        <List.Item key={peerId}>
                            <Group justify="space-between">
                                <Text size="sm" truncate style={{ maxWidth: '200px' }} title={peerId}>{peerId}</Text>
                                <Button
                                    size="xs"
                                    variant={targetPeerIdForP2P === peerId ? "filled" : "outline"}
                                    color={targetPeerIdForP2P === peerId ? theme.primaryColor : "gray"}
                                    onClick={() => handleTargetSelect(peerId)}
                                    leftSection={<IconTargetArrow size="0.8rem" />}
                                >
                                    {targetPeerIdForP2P === peerId ? "当前目标" : "设为目标"}
                                </Button>
                            </Group>
                        </List.Item>
                    ))}
                </List>
            ) : (
                <Text c="dimmed" size="sm" mb="md">暂无其他 Peer。</Text>
            )}

            <Group mb="xs" align="center" gap="xs">
                <Text size="sm">当前 P2P 目标:</Text>
                <Badge color={targetPeerIdForP2P ? "cyan" : "gray"} variant="light">
                    {targetPeerIdForP2P || '未选择'}
                </Badge>
            </Group>

            <Group>
                <Button
                    onClick={handleInitiateCall}
                    // MODIFIED: 确保 isSignalSetup 为 true 才能发起呼叫
                    disabled={!targetPeerIdForP2P || isP2PConnected || !isSignalSetup}
                    leftSection={<IconPhoneCall size="1rem" />}
                >
                    建立P2P连接
                </Button>
                <Button
                    onClick={() => closeP2PConnection('用户手动操作')}
                    disabled={!isP2PConnected}
                    leftSection={<IconPhoneOff size="1rem" />}
                    variant="outline"
                    color="red"
                >
                    断开P2P连接
                </Button>
            </Group>
            {isP2PConnected && targetPeerIdForP2P && (
                <Text c="teal" fw={500} mt="xs" size="sm">
                    <IconCheck size="1rem" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    已与 <Code>{targetPeerIdForP2P}</Code> 建立 P2P 连接！
                </Text>
            )}
        </Paper>
    );
};
export default P2PControl;