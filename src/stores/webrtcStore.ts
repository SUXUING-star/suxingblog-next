// src/stores/webrtcStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer'; // 可选，用于更方便地进行不可变更新

// --- 常量定义 ---
export const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
export const FILE_CHUNK_SIZE = 16 * 1024; // 16KB

// --- 接口定义 ---
// 从服务器接收的信令消息
export interface SignalingMessageFromServer {
    type: 'connected' | 'room_joined' | 'peer_joined' | 'peer_left' | 'offer' | 'answer' | 'candidate' | 'error';
    payload: any; // 具体类型取决于 type
    senderId?: string; // 发送方ID (除了 'connected' 和 'error' 类型)
}

// 发送给服务器的信令消息
export interface SignalingMessageToServer {
    type: 'offer' | 'answer' | 'candidate';
    payload: any; // 具体类型取决于 type (例如 RTCSessionDescriptionInit for offer/answer, RTCIceCandidateInit for candidate)
    targetPeerId?: string; // 目标 Peer ID
}

// 文件元数据
export interface FileMetadata {
    name: string;
    size: number;
    type: string;
    totalChunks: number;
    fileId?: string; // 唯一文件标识符
}

// 日志条目
let logIdCounter = 0; // 用于生成唯一的日志ID
export interface LogEntry {
    id: number;
    time: string;
    type: '日志' | '错误' | '接收' | '发送' | 'WebRTC' | '信令';
    message: string;
}

// Store 的 State 类型
export interface WebRTCState {
    // 日志系统
    logs: LogEntry[];
    maxLogs: number;

    // 信令连接状态
    isSignalConnecting: boolean;
    isSignalConnected: boolean;
    myClientId: string | null;
    currentSignalRoomId: string | null;
    peersInSignalRoom: string[];
    workerBaseUrl: string; // 从环境变量读取，初始化时传入

    // P2P 连接状态
    isP2PConnected: boolean;
    targetPeerIdForP2P: string | null; // 当前选定的P2P通信目标

    // 文件传输 - 发送方
    selectedFile: File | null;
    fileSendProgress: number; // 0-100
    isFileSending: boolean;

    // 文件传输 - 接收方
    receivingFileMetadata: FileMetadata | null;
    receivedFileChunks: ArrayBuffer[]; // 注意：大文件时内存占用
    fileReceiveProgress: number; // 0-100
    lastReceivedFileData: { blob: Blob; metadata: FileMetadata } | null;
    receivedFileDownloadUrl: string | null;

    // 引用 (这些不会直接存在 Zustand state 中，而是通过闭包或 ref 存储在 actions 中或组件中)
    // socketRef: WebSocket | null; // 不直接存 WebSocket 实例，通过 actions 管理
    // peerConnectionRef: RTCPeerConnection | null;
    // dataChannelRef: RTCDataChannel | null;

    // 通知 (简单起见，通知的显示状态和消息可以暂时还由组件的 useDisclosure 管理，store只负责触发)
    // 但也可以把通知消息放到 store 中
    notification: { type: 'success' | 'error' | 'info'; title: string; message: string; id: number } | null;
}

// Store 的 Actions 类型
export interface WebRTCActions {
    // 日志操作
    addLog: (message: string, type?: LogEntry['type']) => void;
    clearLogs: () => void;

    // 初始化环境变量
    setWorkerBaseUrl: (url: string) => void;

    // 信令连接操作
    connectToSignaling: (roomId: string) => Promise<void>; // 改为返回 Promise，方便组件知道连接状态
    disconnectFromSignaling: (reason?: string) => void;
    _handleSignalingOpen: (socket: WebSocket, roomId: string) => void;
    _handleSignalingMessage: (event: MessageEvent, socket: WebSocket) => void;
    _handleSignalingClose: (event: CloseEvent, socket: WebSocket, initiatingDisconnect: boolean) => void;
    _handleSignalingError: (event: Event, socket: WebSocket) => void;
    sendSignalingMessage: (type: SignalingMessageToServer['type'], payload: any, targetPeerId?: string) => boolean;

    // P2P 操作
    setTargetPeerIdForP2P: (peerId: string | null) => void;
    initiateP2PCall: (targetPeerId: string) => Promise<void>; // 改为返回 Promise
    closeP2PConnection: (reason?: string) => void;
    _handleOffer: (offerSdp: RTCSessionDescriptionInit, senderId: string, pc: RTCPeerConnection) => Promise<void>;
    _handleAnswer: (answerSdp: RTCSessionDescriptionInit, senderId: string, pc: RTCPeerConnection) => Promise<void>;
    _handleCandidate: (candidateInit: RTCIceCandidateInit, senderId: string, pc: RTCPeerConnection) => Promise<void>;
    _setupDataChannelEvents: (channel: RTCDataChannel) => void;
    _createPeerConnection: (targetPeerId: string) => RTCPeerConnection | null; // 内部辅助
    _createDataChannel: (pc: RTCPeerConnection, label?: string) => RTCDataChannel | null; // 内部辅助

    // 文件操作
    setSelectedFile: (file: File | null) => void;
    sendFile: () => Promise<boolean>; // 发送当前 selectedFile
    _revokeReceivedFileDownloadUrl: () => void; // 清理旧的 Object URL

    // 通知操作
    showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
    clearNotification: () => void;

    // 内部状态设置 (直接暴露部分 setter 可能不是最佳实践，但为了简化迁移，暂时保留)
    _setIsSignalConnecting: (connecting: boolean) => void;
    _setIsSignalConnected: (connected: boolean) => void;
    _setMyClientId: (id: string | null) => void;
    _setCurrentSignalRoomId: (id: string | null) => void;
    _setPeersInSignalRoom: (peers: string[]) => void;
    _setIsP2PConnected: (connected: boolean) => void;
    _setFileSendProgress: (progress: number) => void;
    _setIsFileSending: (sending: boolean) => void;
}

// Zustand Store (使用 immer 中间件来简化状态更新)
// 注意：WebSocket, RTCPeerConnection, RTCDataChannel 实例不应该直接存储在 Zustand state 中，
// 因为它们不是可序列化的，并且可能包含复杂的内部状态和方法。
// 我们将通过闭包在 action 内部管理这些实例的引用。

let socketInstance: WebSocket | null = null;
let peerConnectionInstance: RTCPeerConnection | null = null;
let dataChannelInstance: RTCDataChannel | null = null;
let activeInitiatingDisconnect = false; // 标志位，防止 onclose 时的意外处理


export const useWebRTCStore = create<WebRTCState & WebRTCActions>()(
    immer((set, get) => ({
        // 初始状态
        logs: [],
        maxLogs: 300,
        isSignalConnecting: false,
        isSignalConnected: false,
        myClientId: null,
        currentSignalRoomId: null,
        peersInSignalRoom: [],
        workerBaseUrl: '', // 需要在应用启动时设置
        isP2PConnected: false,
        targetPeerIdForP2P: null,
        selectedFile: null,
        fileSendProgress: 0,
        isFileSending: false,
        receivingFileMetadata: null,
        receivedFileChunks: [],
        fileReceiveProgress: 0,
        lastReceivedFileData: null,
        receivedFileDownloadUrl: null,
        notification: null,

        // --- Actions ---

        setWorkerBaseUrl: (url) => set({ workerBaseUrl: url }),

        addLog: (message, type = '日志') => {
            const newLog: LogEntry = { id: logIdCounter++, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), type, message };
            console.log(`[Store Log - ${type}] ${message}`);
            set((state) => {
                state.logs = [newLog, ...state.logs.slice(0, state.maxLogs - 1)];
                if (type === '错误' && !state.notification) { // 简单错误通知触发
                    state.notification = { type: 'error', title: '发生错误', message, id: Date.now() };
                }
            });
        },
        clearLogs: () => set({ logs: [] }),

        showNotification: (title, message, type = 'info') => {
            set({ notification: { type, title, message, id: Date.now() } });
        },
        clearNotification: () => set({ notification: null }),

        // 内部状态 Setter (简化)
        _setIsSignalConnecting: (connecting) => set({ isSignalConnecting: connecting }),
        _setIsSignalConnected: (connected) => set({ isSignalConnected: connected }),
        _setMyClientId: (id) => set({ myClientId: id }),
        _setCurrentSignalRoomId: (id) => set({ currentSignalRoomId: id }),
        _setPeersInSignalRoom: (peers) => set({ peersInSignalRoom: peers }),
        _setIsP2PConnected: (connected) => set({ isP2PConnected: connected }),
        _setFileSendProgress: (progress) => set({ fileSendProgress: progress }),
        _setIsFileSending: (sending) => set({ isFileSending: sending }),


        connectToSignaling: async (roomId) => {
            const { isSignalConnecting, isSignalConnected, workerBaseUrl, addLog, showNotification, _handleSignalingOpen, _handleSignalingMessage, _handleSignalingClose, _handleSignalingError } = get();
            if (isSignalConnecting || isSignalConnected) {
                addLog(isSignalConnecting ? '正在连接信令服务器...' : '已连接到信令服务器，无需重复。', '日志');
                if (isSignalConnected) showNotification('提示', '已连接，无需重复操作。', 'info');
                return;
            }
            if (!roomId.trim()) { addLog('请输入房间ID。', '错误'); return; }
            if (!workerBaseUrl) { addLog('信令服务器URL未配置。', '错误'); return; }

            const wsPath = `/room/${encodeURIComponent(roomId.trim())}`;
            let wsUrl;
            try {
                const parsedWorkerUrl = new URL(workerBaseUrl);
                const protocol = parsedWorkerUrl.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${protocol}//${parsedWorkerUrl.host}${parsedWorkerUrl.pathname.replace(/\/$/, '')}${wsPath}`;
            } catch (e) {
                addLog(`环境变量 VITE_WORKER_SIGNALING_URL ("${workerBaseUrl}") 无效。`, '错误'); return;
            }

            addLog(`尝试连接到信令服务器: ${wsUrl}`, '信令');
            set({ isSignalConnecting: true, notification: null }); // 清除旧通知
            activeInitiatingDisconnect = false; // 重置标志位

            try {
                const newSocket = new WebSocket(wsUrl);
                socketInstance = newSocket; // 在闭包中存储实例

                newSocket.onopen = () => _handleSignalingOpen(newSocket, roomId);
                newSocket.onmessage = (event) => _handleSignalingMessage(event, newSocket);
                newSocket.onclose = (event) => _handleSignalingClose(event, newSocket, activeInitiatingDisconnect);
                newSocket.onerror = (event) => _handleSignalingError(event, newSocket);

            } catch (error) {
                addLog(`创建 WebSocket 连接失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                set({ isSignalConnecting: false });
                socketInstance = null;
            }
        },

        _handleSignalingOpen: (socket, roomId) => {
            if (socketInstance !== socket) return; // 过时的socket
            get().addLog('信令服务器连接成功。', '信令');
            set({ isSignalConnected: true, isSignalConnecting: false, currentSignalRoomId: roomId });
            get().showNotification('连接成功', `已连接到房间: ${roomId}`, 'success');
        },

        _handleSignalingMessage: (event, socket) => {
            if (socketInstance !== socket) return;
            const { addLog, myClientId, targetPeerIdForP2P, _handleOffer, _handleAnswer, _handleCandidate, closeP2PConnection } = get();
            try {
                const message = JSON.parse(event.data as string) as SignalingMessageFromServer;
                addLog(`收到信令 (${message.type}) <- ${message.senderId || '服务器'}: ${JSON.stringify(message.payload).substring(0, 100)}...`, '接收');
                switch (message.type) {
                    case 'connected':
                        set({ myClientId: message.payload.clientId, currentSignalRoomId: message.payload.roomId });
                        const peers = (message.payload.peersInRoom || []).filter((p: string) => p !== message.payload.clientId);
                        set({ peersInSignalRoom: peers });
                        addLog(`信令已连接！我的ID: ${message.payload.clientId}。房间: ${message.payload.roomId}。Peers: ${peers.join(', ') || '无'}`, '信令');
                        break;
                    case 'peer_joined':
                        if (message.payload.peerId !== myClientId) {
                            addLog(`Peer ${message.payload.peerId} 加入了房间。`, '信令');
                            set(state => ({ peersInSignalRoom: state.peersInSignalRoom.includes(message.payload.peerId) ? state.peersInSignalRoom : [...state.peersInSignalRoom, message.payload.peerId] }));
                        }
                        break;
                    case 'peer_left':
                        addLog(`Peer ${message.payload.peerId} 离开了房间。`, '信令');
                        set(state => ({
                            peersInSignalRoom: state.peersInSignalRoom.filter(
                                (p: string) => p !== message.payload.peerId // 明确指定 p 的类型为 string
                            )
                        }));
                        if (targetPeerIdForP2P === message.payload.peerId) {
                            set({ targetPeerIdForP2P: null });
                            closeP2PConnection('对方离开房间');
                            addLog(`与 Peer ${message.payload.peerId} 的 P2P 连接已关闭 (对方离开)。`, 'WebRTC');
                        }
                        break;
                    case 'offer':
                        if (message.senderId && message.payload && peerConnectionInstance) {
                            _handleOffer(message.payload as RTCSessionDescriptionInit, message.senderId, peerConnectionInstance);
                        } else if (message.senderId && message.payload) { // No PC yet, need to create one
                            const newPc = get()._createPeerConnection(message.senderId);
                            if (newPc) {
                                _handleOffer(message.payload as RTCSessionDescriptionInit, message.senderId, newPc);
                            }
                        }
                        break;
                    case 'answer':
                        if (message.senderId && message.payload && peerConnectionInstance) {
                            _handleAnswer(message.payload as RTCSessionDescriptionInit, message.senderId, peerConnectionInstance);
                        }
                        break;
                    case 'candidate':
                        if (message.senderId && message.payload && message.payload.candidate && peerConnectionInstance) {
                            // 确保 peerConnectionInstance 存在并且已经设置了 remoteDescription
                            if (!peerConnectionInstance.remoteDescription) {
                                addLog('[Store] 收到 Candidate 但远端描述尚未设置，将尝试稍后处理 (或丢弃，取决于实现)。');
                                // 这里可以实现一个简单的 candidate 缓冲队列，等 remoteDescription 设置后再处理。
                                // 为简单起见，暂时先打印警告。如果问题持续，需要实现缓冲。
                            } else {
                                _handleCandidate(message.payload.candidate as RTCIceCandidateInit, message.senderId, peerConnectionInstance);
                            }
                        } else if (!peerConnectionInstance && message.senderId && message.payload && message.payload.candidate) {
                            addLog('[Store] 收到 Candidate 但 PeerConnection 未初始化。Candidate 被忽略。');
                            // 如果此时还没有 peerConnectionInstance，这个 candidate 几乎肯定是无法处理的。
                        }
                        break;
                    case 'error':
                        addLog(`信令服务器错误: ${message.payload.message || JSON.stringify(message.payload)}`, '错误');
                        break;
                    default:
                        addLog(`收到未知信令类型: ${(message as any).type}`, '信令');
                }
            } catch (error) {
                addLog(`处理信令消息出错: ${event.data}. 详情: ${error instanceof Error ? error.message : String(error)}`, '错误');
            }
        },

        _handleSignalingClose: (event, socket, initiatingDisconnect) => {
            // 只处理当前活动的 socket 的关闭事件，除非是用户主动断开（initiatingDisconnect 为 true）
            if (socketInstance !== socket && !initiatingDisconnect) {
                get().addLog(`一个旧的/过时的信令 WebSocket 连接关闭 (代码: ${event.code})，已被忽略。`, '日志');
                return;
            }
            if (initiatingDisconnect && socketInstance !== socket) { // 主动断开的是另一个socket，忽略
                return;
            }


            const { addLog, showNotification, closeP2PConnection, isSignalConnected: wasConnected } = get();
            const logMsg = `信令服务器连接断开。代码: ${event.code}, 原因: ${event.reason || '无'}`;
            addLog(logMsg, event.wasClean ? '信令' : '错误');

            // 只有在之前确实是连接状态，并且不是用户主动干净断开的情况下，才显示错误通知
            if (wasConnected && !event.wasClean && !initiatingDisconnect) {
                showNotification('信令断开', logMsg, 'error');
            }


            set({
                isSignalConnected: false,
                isSignalConnecting: false,
                myClientId: null,
                currentSignalRoomId: null,
                peersInSignalRoom: []
            });
            closeP2PConnection('信令连接关闭');

            if (socketInstance === socket) { // 清理当前的socketInstance
                socketInstance = null;
            }
        },

        _handleSignalingError: (event, socket) => {
            if (socketInstance !== socket) return;
            get().addLog('信令服务器 WebSocket 发生错误。 "onclose" 事件将随后触发。', '错误');
            console.error('信令 WebSocket onerror 事件:', event);
            // onclose 会处理状态清理
        },

        disconnectFromSignaling: (reason = '用户手动断开') => {
            const { addLog, showNotification, closeP2PConnection } = get();
            activeInitiatingDisconnect = true; // 设置标志位

            if (socketInstance) {
                addLog(`手动断开信令服务器连接 (${reason})...`, '信令');
                const currentSocket = socketInstance;
                socketInstance = null; // 防止 onclose 再次触发逻辑 (尤其是在react严格模式下)

                currentSocket.onopen = null;
                currentSocket.onmessage = null;
                currentSocket.onerror = null;
                // 不要完全移除 onclose，而是让它执行一个最小化的版本或检查 activeInitiatingDisconnect
                currentSocket.onclose = (event: CloseEvent) => {
                    console.log(`[Store Log] WebSocket for ${currentSocket.url} closed by manual disconnect (reason: ${event.reason}).`);
                    // 不在这里调用 get()._handleSignalingClose() 以避免循环或重复逻辑
                    // 状态已经在下面设置了
                };

                if (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING) {
                    currentSocket.close(1000, reason);
                }
            } else {
                addLog('没有活动的信令连接可断开。', '日志');
            }

            // 立即更新状态，不依赖 onclose
            set({
                isSignalConnected: false,
                isSignalConnecting: false, // 如果正在连接中，也取消
                myClientId: null,
                currentSignalRoomId: null,
                peersInSignalRoom: []
            });
            closeP2PConnection(`信令手动断开: ${reason}`);
            showNotification('已断开', `已成功断开与信令服务器的连接 (${reason})。`, 'info');
        },

        sendSignalingMessage: (type, payload, targetPeerId) => {
            const { addLog } = get();
            if (!socketInstance || socketInstance.readyState !== WebSocket.OPEN) {
                addLog('信令服务器未连接，无法发送消息。', '错误');
                return false;
            }
            const message: SignalingMessageToServer = { type, payload };
            if (targetPeerId) message.targetPeerId = targetPeerId;
            const messageString = JSON.stringify(message);
            try {
                socketInstance.send(messageString);
                addLog(`发送信令 (${type}) -> ${targetPeerId || '广播'}: ${messageString.substring(0, 100)}...`, '发送');
                return true;
            } catch (error) {
                addLog(`发送信令 (${type}) 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                return false;
            }
        },

        // --- P2P Actions ---
        setTargetPeerIdForP2P: (peerId) => {
            const { targetPeerIdForP2P: currentTarget, isP2PConnected, closeP2PConnection, addLog } = get();
            if (peerId === currentTarget) return; // No change

            if (isP2PConnected) { // If currently connected and target changes, close old P2P
                addLog(`P2P 目标从 ${currentTarget} 切换到 ${peerId || '无'}，关闭旧连接。`, 'WebRTC');
                closeP2PConnection('切换P2P目标');
            }
            set({ targetPeerIdForP2P: peerId });
            if (peerId) {
                addLog(`已选择 Peer ${peerId} 作为 P2P 通信目标。`, '日志');
            } else {
                addLog('已取消 P2P 通信目标选择。', '日志');
            }
        },

        _createPeerConnection: (targetPeerId) => {
            const { addLog, showNotification, sendSignalingMessage, _setupDataChannelEvents, closeP2PConnection } = get();
            addLog(`[Store] 创建到 Peer ${targetPeerId} 的 RTCPeerConnection...`, 'WebRTC');

            if (peerConnectionInstance && peerConnectionInstance.signalingState !== 'closed') {
                addLog('[Store] 已存在活动 PeerConnection，先关闭旧的。', 'WebRTC');
                closeP2PConnection('创建新PC前清理'); // 使用 store 里的 closeP2PConnection
            }
            try {
                const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
                peerConnectionInstance = pc; // Store instance in closure

                pc.onicecandidate = (event) => {
                    if (event.candidate && socketInstance?.readyState === WebSocket.OPEN) {
                        sendSignalingMessage('candidate', { candidate: event.candidate.toJSON() }, targetPeerId);
                    }
                };
                pc.oniceconnectionstatechange = () => {
                    addLog(`[Store] ICE 连接状态: ${pc.iceConnectionState}`, 'WebRTC');
                    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
                        // 可以在这里触发更彻底的P2P清理，但要小心循环
                        // closeP2PConnection('ICE状态变化');
                    }
                };
                pc.onconnectionstatechange = () => {
                    addLog(`[Store] P2P 连接状态: ${pc.connectionState}`, 'WebRTC');
                    if (pc.connectionState === 'connected') {
                        set({ isP2PConnected: true });
                        showNotification('P2P 连接成功', `已与 ${targetPeerId} 建立P2P连接！`, 'success');
                    } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                        set({ isP2PConnected: false });
                        // 如果不是主动关闭，可以提示用户
                        if (pc.connectionState !== 'closed' || !activeInitiatingDisconnect) { // (activeInitiatingDisconnect might need refinement for P2P)
                            showNotification('P2P 连接中断', `与 ${targetPeerId} 的P2P连接已${pc.connectionState}。`, 'error');
                        }
                    }
                };
                pc.ondatachannel = (event) => {
                    addLog(`[Store] 收到对方创建的 DataChannel: ${event.channel.label}`, 'WebRTC');
                    const dc = event.channel;
                    _setupDataChannelEvents(dc);
                    dataChannelInstance = dc; // Store instance in closure
                };
                return pc;
            } catch (error) {
                addLog(`[Store] 创建 RTCPeerConnection 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                peerConnectionInstance = null;
                return null;
            }
        },
        _createDataChannel: (pc, label = "fileTransferChannel_zustand") => {
            const { addLog, _setupDataChannelEvents } = get();
            addLog(`[Store] 创建 DataChannel: "${label}"`, 'WebRTC');
            if (!pc || pc.signalingState === 'closed') {
                addLog('[Store] PeerConnection 不存在或已关闭，无法创建 DataChannel。', '错误');
                return null;
            }
            try {
                const dc = pc.createDataChannel(label, { ordered: true });
                _setupDataChannelEvents(dc);
                dataChannelInstance = dc; // Store instance
                return dc;
            } catch (e) {
                addLog(`[Store] 创建 DataChannel "${label}" 失败: ${e instanceof Error ? e.message : String(e)}`, '错误');
                return null;
            }
        },

        _setupDataChannelEvents: (channel) => {
            const { addLog, showNotification, _revokeReceivedFileDownloadUrl } = get();
            channel.binaryType = 'arraybuffer';

            channel.onopen = () => {
                addLog(`[Store] P2P 数据通道 "${channel.label}" 已打开！`, 'WebRTC');
                set({
                    receivingFileMetadata: null, // Reset for new connection
                    receivedFileChunks: [],
                    fileReceiveProgress: 0,
                });
            };
            channel.onclose = () => {
                addLog(`[Store] P2P 数据通道 "${channel.label}" 已关闭。`, 'WebRTC');
                // dataChannelInstance = null; // Clean up ref, P2P close should handle this too
            };
            channel.onerror = (event) => {
                const errorEvent = event as RTCErrorEvent; // Type assertion
                addLog(`[Store] P2P 数据通道 "${channel.label}" 发生错误: ${errorEvent.error?.message || JSON.stringify(event)}`, '错误');
            };
            channel.onmessage = (event: MessageEvent) => {
                if (typeof event.data === 'string') {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'file_metadata') {
                            const metadata = message.payload as FileMetadata;
                            addLog(`[Store] 收到文件元数据: ${metadata.name} (总块数: ${metadata.totalChunks})`, '接收');
                            _revokeReceivedFileDownloadUrl(); // Clean up previous download URL
                            set({
                                receivingFileMetadata: metadata,
                                receivedFileChunks: [], // Reset for new file
                                fileReceiveProgress: 0,
                                lastReceivedFileData: null, // Clear previous downloaded file display
                                receivedFileDownloadUrl: null,
                            });
                        } else {
                            addLog(`[Store] DataChannel 收到文本: ${event.data.substring(0, 100)}...`, '接收');
                        }
                    } catch (e) {
                        addLog(`[Store] DataChannel 收到无法解析文本: ${event.data.substring(0, 100)}...`, '接收');
                    }
                } else if (event.data instanceof ArrayBuffer) {
                    const currentReceivingMeta = get().receivingFileMetadata;
                    if (!currentReceivingMeta) {
                        addLog('[Store] 收到文件块但无元数据，已忽略。', '错误');
                        return;
                    }
                    const newChunks = [...get().receivedFileChunks, event.data];
                    const progress = Math.round((newChunks.length / currentReceivingMeta.totalChunks) * 100);
                    set({ receivedFileChunks: newChunks, fileReceiveProgress: progress });

                    if (newChunks.length === currentReceivingMeta.totalChunks) {
                        addLog(`[Store] 文件 "${currentReceivingMeta.name}" 所有块接收完毕！正在重组...`, 'WebRTC');
                        const fileBlob = new Blob(newChunks, { type: currentReceivingMeta.type });
                        showNotification('文件接收成功', `文件 "${currentReceivingMeta.name}" 已接收。`, 'success');
                        const url = URL.createObjectURL(fileBlob);
                        set({
                            lastReceivedFileData: { blob: fileBlob, metadata: currentReceivingMeta },
                            receivedFileDownloadUrl: url,
                            // Optional: reset receivingFileMetadata here if you don't want to show "receiving X" anymore
                            // receivingFileMetadata: null,
                            // receivedFileChunks: [], // Already done when new metadata arrives
                        });
                    }
                } else {
                    addLog(`[Store] DataChannel 收到未知类型数据: ${typeof event.data}`, '接收');
                }
            };
        },

        _handleOffer: async (offerSdp, senderId, pc) => {
            const { myClientId, addLog, sendSignalingMessage, closeP2PConnection, _createPeerConnection, setTargetPeerIdForP2P } = get();
            if (!socketInstance || socketInstance.readyState !== WebSocket.OPEN || !myClientId) {
                addLog('[Store] 信令服务未连接或我的ID未知，无法处理 Offer。', '错误'); return;
            }

            // If the offer is from a new peer, or if the existing PC is for a different peer, create a new PC.
            // This logic might need refinement if multiple offers can arrive concurrently for different peers.
            let currentPC = pc;
            if (!currentPC || (currentPC !== peerConnectionInstance) || (peerConnectionInstance && peerConnectionInstance.remoteDescription && !peerConnectionInstance.remoteDescription.sdp.includes(senderId))) {
                // If there's an existing PC for a different peer, close it first.
                if (peerConnectionInstance && peerConnectionInstance.signalingState !== 'closed') {
                    addLog(`[Store] 收到来自 ${senderId} 的 Offer，但当前PC是为其他人，关闭旧PC。`, 'WebRTC');
                    closeP2PConnection('处理新Offer前清理旧PC');
                }
                currentPC = _createPeerConnection(senderId) as RTCPeerConnection; // Re-assign
                if (!currentPC) {
                    addLog('[Store] 创建新 PeerConnection 失败，无法处理 Offer。', '错误');
                    return;
                }
            }

            addLog(`[Store] 收到来自 ${senderId} 的 Offer。准备处理...`, 'WebRTC');
            setTargetPeerIdForP2P(senderId); // Ensure target is set

            try {
                await currentPC.setRemoteDescription(new RTCSessionDescription(offerSdp));
                addLog('[Store] 远程描述 (Offer) 已设置。创建 Answer...', 'WebRTC');
                const answer = await currentPC.createAnswer();
                await currentPC.setLocalDescription(answer);
                addLog('[Store] Answer 已创建并设置本地描述。通过信令发送 Answer...', 'WebRTC');
                sendSignalingMessage('answer', { type: answer.type, sdp: answer.sdp }, senderId);
            } catch (error) {
                addLog(`[Store] 处理 Offer 或创建/发送 Answer 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                closeP2PConnection('Offer处理失败');
            }
        },
        _handleAnswer: async (answerSdp, senderId, pc) => {
            const { addLog, closeP2PConnection } = get();
            addLog(`[Store] 收到来自 ${senderId} 的 Answer。`, 'WebRTC');
            if (!pc || pc.signalingState === 'closed') {
                addLog('[Store] PeerConnection 不存在或已关闭，无法处理 Answer。', '错误'); return;
            }
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
                addLog('[Store] 远程描述 (Answer) 已设置。P2P 连接应该即将建立。', 'WebRTC');
            } catch (error) {
                addLog(`[Store] 设置远程描述 (Answer) 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                closeP2PConnection('Answer处理失败');
            }
        },
        _handleCandidate: async (candidateInit, senderId, pc) => {
            const { addLog } = get();
            addLog(`[Store] 收到来自 ${senderId} 的 ICE Candidate。`, 'WebRTC');
            if (!pc || pc.signalingState === 'closed' || !pc.remoteDescription) { // RemoteDescription must be set first
                addLog('[Store] PeerConnection 不存在、已关闭或无远程描述，无法添加 ICE Candidate。', '错误');
                return;
            }
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
                addLog('[Store] ICE Candidate 已添加。', 'WebRTC');
            } catch (error) {
                // Common error: "Error processing ICE candidate" if remote description isn't set.
                addLog(`[Store] 添加 ICE Candidate 失败: ${error instanceof Error ? error.message : String(error)} (${JSON.stringify(candidateInit)})`, '错误');
            }
        },

        initiateP2PCall: async (targetPeerId) => {
            const { myClientId, addLog, sendSignalingMessage, closeP2PConnection, _createPeerConnection, _createDataChannel, isP2PConnected, targetPeerIdForP2P: currentTarget } = get();

            if (!socketInstance || socketInstance.readyState !== WebSocket.OPEN || !myClientId) {
                addLog('[Store] 信令服务未连接或我的ID未知，无法发起呼叫。', '错误'); return;
            }
            if (targetPeerId === myClientId) {
                addLog('[Store] 不能与自己建立 P2P 连接。', '错误'); return;
            }
            if (isP2PConnected && currentTarget === targetPeerId) {
                addLog(`[Store] 已与 ${targetPeerId} 连接，无需重复。`, '日志'); return;
            }

            addLog(`[Store] 向 ${targetPeerId} 发起 P2P 呼叫...`, 'WebRTC');
            // Ensure P2P target is set correctly in store, even if called directly
            set({ targetPeerIdForP2P: targetPeerId });

            const pc = _createPeerConnection(targetPeerId);
            if (!pc) { addLog('[Store] 创建 PeerConnection 失败。', '错误'); return; }

            const dc = _createDataChannel(pc);
            if (!dc) { addLog('[Store] 创建 DataChannel 失败。', '错误'); closeP2PConnection('P2P呼叫时DC创建失败'); return; }

            try {
                addLog('[Store] 创建 Offer...', 'WebRTC');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                addLog('[Store] Offer 已创建并发送...', 'WebRTC');
                sendSignalingMessage('offer', { type: offer.type, sdp: offer.sdp }, targetPeerId);
            } catch (error) {
                addLog(`[Store] 创建或发送 Offer 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                closeP2PConnection('P2P呼叫时Offer失败');
            }
        },

        closeP2PConnection: (reason = '未知原因') => {
            const { addLog } = get();
            addLog(`[Store] 尝试关闭 P2P 连接... (原因: ${reason})`, 'WebRTC');

            if (dataChannelInstance) {
                if (dataChannelInstance.readyState === 'open' || dataChannelInstance.readyState === 'connecting') {
                    dataChannelInstance.close();
                }
                dataChannelInstance.onopen = null;
                dataChannelInstance.onclose = null;
                dataChannelInstance.onerror = null;
                dataChannelInstance.onmessage = null;
                dataChannelInstance = null;
            }
            if (peerConnectionInstance) {
                if (peerConnectionInstance.signalingState !== 'closed') {
                    peerConnectionInstance.close();
                }
                peerConnectionInstance.onicecandidate = null;
                peerConnectionInstance.oniceconnectionstatechange = null;
                peerConnectionInstance.onconnectionstatechange = null;
                peerConnectionInstance.ondatachannel = null;
                peerConnectionInstance = null;
            }

            set({
                isP2PConnected: false,
                // targetPeerIdForP2P: null, // Keep target unless explicitly changed by setTargetPeerIdForP2P
                receivingFileMetadata: null,
                receivedFileChunks: [],
                fileReceiveProgress: 0,
                // Don't clear lastReceivedFileData or URL here, user might still want to download
            });
            addLog(`[Store] P2P 连接资源已清理。 (原因: ${reason})`, 'WebRTC');
        },

        // --- File Actions ---
        setSelectedFile: (file) => {
            set({ selectedFile: file, fileSendProgress: 0 }); // Reset progress
            if (file) get().addLog(`[Store] 已选文件: ${file.name}`, '日志');
            else get().addLog('[Store] 取消选择文件。', '日志');
        },

        _revokeReceivedFileDownloadUrl: () => {
            const oldUrl = get().receivedFileDownloadUrl;
            if (oldUrl) {
                URL.revokeObjectURL(oldUrl);
                set({ receivedFileDownloadUrl: null });
                console.log(`[Store Log] Revoked old object URL: ${oldUrl}`);
            }
        },

        sendFile: async () => {
            const { selectedFile, isP2PConnected, addLog, showNotification, _setFileSendProgress, _setIsFileSending } = get();

            if (!selectedFile) { addLog('[Store] 请先选择一个文件。', '错误'); return false; }
            if (!isP2PConnected || !dataChannelInstance || dataChannelInstance.readyState !== 'open') {
                addLog('[Store] P2P 未连接或DataChannel未打开，无法发送文件。', '错误');
                return false;
            }
            if (get().isFileSending) { addLog('[Store] 正在发送其他文件，请稍候。', '日志'); return false; }

            _setIsFileSending(true);
            _setFileSendProgress(0);
            addLog(`[Store] 准备发送文件: ${selectedFile.name} (大小: ${selectedFile.size} bytes)`, '发送');

            const totalChunks = Math.ceil(selectedFile.size / FILE_CHUNK_SIZE);
            const metadata: FileMetadata = {
                name: selectedFile.name,
                size: selectedFile.size,
                type: selectedFile.type,
                totalChunks,
                fileId: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
            };

            try {
                dataChannelInstance.send(JSON.stringify({ type: 'file_metadata', payload: metadata }));
            } catch (e) {
                addLog(`[Store] 发送文件元数据失败: ${e instanceof Error ? e.message : String(e)}`, '错误');
                _setIsFileSending(false);
                return false;
            }

            let offset = 0;
            let chunkCount = 0;
            const reader = new FileReader();

            const readAndSendChunk = (): Promise<boolean> => {
                return new Promise<boolean>((resolve, reject) => {
                    if (!dataChannelInstance || dataChannelInstance.readyState !== 'open') {
                        addLog('[Store] 文件发送中断：DataChannel已关闭（在readAndSendChunk中）。', '错误');
                        reject(new Error('DataChannel closed'));
                        return;
                    }
                    // Buffered amount check
                    while (dataChannelInstance && dataChannelInstance.bufferedAmount > FILE_CHUNK_SIZE * 16) { // 16 * 16KB = 256KB buffer limit
                        // This sync loop might block, consider async await for setTimeout
                        // For simplicity here, assuming it clears relatively fast or a short sync wait is acceptable
                        // await new Promise(r => setTimeout(r, 10)); // If made async
                        console.log(`[Store Log] DataChannel buffer high (${dataChannelInstance.bufferedAmount}), brief pause.`);
                        // A real implementation might use requestAnimationFrame or setTimeout in a loop
                    }


                    const slice = selectedFile.slice(offset, offset + FILE_CHUNK_SIZE);
                    reader.onload = (e_onload) => {
                        const chunk = e_onload.target?.result as ArrayBuffer;
                        if (dataChannelInstance?.readyState === 'open') {
                            try {
                                dataChannelInstance.send(chunk);
                                chunkCount++;
                                offset += chunk.byteLength;
                                const prog = totalChunks > 0 ? Math.round((chunkCount / totalChunks) * 100) : (selectedFile.size === 0 ? 100 : 0);
                                _setFileSendProgress(prog);
                                resolve(true);
                            } catch (err_send) {
                                addLog(`[Store] 发送块 ${chunkCount + 1} 失败: ${err_send instanceof Error ? err_send.message : String(err_send)}`, '错误');
                                reject(err_send);
                            }
                        } else {
                            addLog('[Store] DataChannel 在发送块时关闭。', '错误');
                            reject(new Error('DataChannel closed during chunk send'));
                        }
                    };
                    reader.onerror = (e_onerror) => {
                        addLog(`[Store] 读文件块失败: ${reader.error?.message}`, '错误');
                        reject(reader.error);
                    };
                    reader.readAsArrayBuffer(slice);
                });
            };

            try {
                for (let i = 0; i < totalChunks; i++) {
                    if (!dataChannelInstance || dataChannelInstance.readyState !== 'open') {
                        addLog('[Store] 文件发送中断：DataChannel已关闭（在主循环中）。', '错误');
                        throw new Error('DataChannel closed during file send loop');
                    }
                    await readAndSendChunk(); // Await each chunk to be processed
                }
                // Handle zero-byte files
                if (totalChunks === 0 && selectedFile.size === 0) {
                    _setFileSendProgress(100);
                }

                addLog(`[Store] 文件 "${selectedFile.name}" 发送处理完成！`, '发送');
                showNotification('发送完毕', `文件 "${selectedFile.name}" 已成功发送。`, 'success');
                _setIsFileSending(false);
                return true;
            } catch (err) {
                addLog(`[Store] 发送文件 "${selectedFile.name}" 过程中出错: ${err instanceof Error ? err.message : String(err)}`, '错误');
                const finalProgressOnError = totalChunks > 0 ? Math.round((chunkCount / totalChunks) * 100) : 0;
                _setFileSendProgress(finalProgressOnError);
                _setIsFileSending(false);
                showNotification('发送失败', `文件 "${selectedFile.name}"未能成功发送。`, 'error');
                return false;
            }
        }
    }))
);

// --- Helper to get non-reactive fresh state if needed outside components ---
// export const getWebRTCState = () => useWebRTCStore.getState();