// src/stores/webrtcStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// --- 常量定义 ---
export const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
export const FILE_CHUNK_SIZE = 16 * 1024; // 16KB
const POLLING_INTERVAL = 3000; // HTTP 轮询间隔（毫秒），例如3秒

// --- 接口定义 ---

// 通过 HTTP API 发送和接收的信令消息结构
export interface ApiSignal {
    type: 'offer' | 'answer' | 'candidate' | 'peer_joined' | 'peer_left' | 'error' | 'room_state' | 'connected_ack';
    payload: any; // 具体内容取决于 type
    senderId?: string; // 原始发送者 clientId
    targetPeerId?: string; // 对于 offer, answer, candidate, 需要指定目标 clientId
    messageId: string; // 由服务器生成的唯一消息ID
    timestamp: number; // 由服务器生成的时间戳
    roomId?: string; // 消息所属的房间 (主要由API端点路径决定，但包含在内可能有用)
}

// 前端发送给 API 的信令请求体结构 (不包含 messageId 和 timestamp)
export interface ApiSignalRequest {
    type: 'offer' | 'answer' | 'candidate';
    payload: any;
    senderId: string; // 当前客户端的 ID
    targetPeerId: string; // 目标客户端的 ID
    roomId: string; // 当前房间的 ID
}

// 文件元数据接口
export interface FileMetadata {
    name: string;
    size: number;
    type: string;
    totalChunks: number;
    fileId?: string; // 唯一文件标识符
}

// 日志条目接口
let logIdCounter = 0; // 用于生成唯一的日志ID
export interface LogEntry {
    id: number;
    time: string;
    type: '日志' | '警告' | '错误' | '接收' | '发送' | 'WebRTC' | '信令' | 'API'; // 增加 API 类型
    message: string;
}

// Store 的 State 类型
export interface WebRTCState {
    logs: LogEntry[];
    maxLogs: number;
    apiBaseUrl: string; // Next.js API 的基础 URL (例如 "/api/signal")
    isSignalSetup: boolean;
    isConnectingOrJoining: boolean;
    isPolling: boolean;
    pollingIntervalId: number | null;
    myClientId: string | null;
    currentRoomId: string | null;
    peersInSignalRoom: string[];
    lastSignalTimestampProcessed: number | null;
    isP2PConnected: boolean;
    targetPeerIdForP2P: string | null;
    selectedFile: File | null;
    fileSendProgress: number;
    isFileSending: boolean;
    receivingFileMetadata: FileMetadata | null;
    receivedFileChunks: ArrayBuffer[];
    fileReceiveProgress: number;
    lastReceivedFileData: { blob: Blob; metadata: FileMetadata } | null;
    receivedFileDownloadUrl: string | null;
    notification: { type: 'success' | 'error' | 'info'; title: string; message: string; id: number } | null;
}

// Store 的 Actions 类型
export interface WebRTCActions {
    addLog: (message: string, type?: LogEntry['type']) => void;
    clearLogs: () => void;
    setApiBaseUrl: (url: string) => void;
    joinRoomAndSetupSignaling: (roomId: string, desiredClientId?: string) => Promise<boolean>;
    leaveRoom: () => Promise<void>;
    sendApiSignal: (signalRequest: ApiSignalRequest) => Promise<boolean>;
    _fetchSignals: () => Promise<void>;
    startPollingSignals: () => void;
    stopPollingSignals: () => void;
    _handleReceivedApiSignal: (signal: ApiSignal) => void;
    setTargetPeerIdForP2P: (peerId: string | null) => void;
    initiateP2PCall: (targetPeerId: string) => Promise<void>;
    closeP2PConnection: (reason?: string) => void;
    _createPeerConnection: (targetPeerId: string) => RTCPeerConnection | null;
    _createDataChannel: (pc: RTCPeerConnection, label?: string) => RTCDataChannel | null;
    _setupDataChannelEvents: (channel: RTCDataChannel) => void;
    _handleOfferViaApi: (offerSdp: RTCSessionDescriptionInit, senderId: string, pc: RTCPeerConnection) => Promise<void>;
    _handleAnswerViaApi: (answerSdp: RTCSessionDescriptionInit, senderId: string, pc: RTCPeerConnection) => Promise<void>;
    _handleCandidateViaApi: (candidateInit: RTCIceCandidateInit, senderId: string, pc: RTCPeerConnection) => Promise<void>;
    setSelectedFile: (file: File | null) => void;
    sendFile: () => Promise<boolean>;
    _revokeReceivedFileDownloadUrl: () => void;
    showNotification: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
    clearNotification: () => void;
    _setIsP2PConnected: (connected: boolean) => void;
    _setFileSendProgress: (progress: number) => void;
    _setIsFileSending: (sending: boolean) => void;
    cleanupStore: () => void;
}

let peerConnectionInstance: RTCPeerConnection | null = null;
let dataChannelInstance: RTCDataChannel | null = null;

export const useWebRTCStore = create<WebRTCState & WebRTCActions>()(
    immer((set, get) => ({
        // --- 初始状态 ---
        logs: [],
        maxLogs: 300,
        apiBaseUrl: '',
        isSignalSetup: false,
        isConnectingOrJoining: false,
        isPolling: false,
        pollingIntervalId: null,
        myClientId: null,
        currentRoomId: null,
        peersInSignalRoom: [],
        lastSignalTimestampProcessed: null,
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

        // --- Actions 实现 ---
        addLog: (message, type = '日志') => {
            const newLog: LogEntry = { id: logIdCounter++, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), type, message };
            console.log(`[Store Log - ${type}] ${message}`);
            set((state) => {
                state.logs = [newLog, ...state.logs.slice(0, state.maxLogs - 1)];
                if (type === '错误' && (!state.notification || state.notification.type !== 'error')) { // 避免覆盖已有的错误通知
                    state.notification = { type: 'error', title: '错误', message, id: Date.now() };
                }
            });
        },
        clearLogs: () => set({ logs: [] }),

         // --- Actions 实现 ---
        setApiBaseUrl: (url) => {
            // 确保传入的 URL 是有效的，并且没有多余的末尾斜杠 (可选优化)
            const cleanedUrl = url.replace(/\/$/, '');
            console.log(`[Store] API Base URL set to: ${cleanedUrl}`);
            set({ apiBaseUrl: cleanedUrl });
        },


        showNotification: (title, message, type = 'info') => {
            set({ notification: { type, title, message, id: Date.now() } });
        },
        clearNotification: () => set({ notification: null }),

        joinRoomAndSetupSignaling: async (roomId, desiredClientId) => {
            const { apiBaseUrl, addLog, showNotification, startPollingSignals, myClientId: currentMyClientId, currentRoomId: currentRoomIdInState, isSignalSetup: currentIsSignalSetup, isConnectingOrJoining: currentIsConnecting } = get();

            if (currentIsConnecting) {
                addLog('正在尝试加入房间，请稍候...', 'API');
                return false;
            }
            if (currentIsSignalSetup && currentRoomIdInState === roomId && currentMyClientId) {
                addLog(`已在房间 ${roomId} 中 (ID: ${currentMyClientId})，无需重复加入。确保轮询已启动。`, 'API');
                startPollingSignals(); // 确保轮询是活动的
                return true;
            }

            set({ isConnectingOrJoining: true, currentRoomId: roomId, notification: null }); // 先设置 roomId，以便后续请求使用
            addLog(`尝试加入房间: ${roomId}...`, 'API');

            try {
                  const response = await fetch(`${apiBaseUrl}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId }), 
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: `加入房间失败，HTTP状态码: ${response.status}` }));
                    throw new Error(errorData.message || `加入房间失败，HTTP状态码: ${response.status}`);
                }

                const data = await response.json() as { clientId: string, roomId: string, peersInRoom: string[] };
                set(state => {
                    state.myClientId = data.clientId;
                    state.currentRoomId = data.roomId;
                    state.peersInSignalRoom = (data.peersInRoom || []).filter(p => p !== data.clientId); // 确保不包含自己
                    state.isSignalSetup = true;
                    state.isConnectingOrJoining = false;
                    state.lastSignalTimestampProcessed = Date.now(); // 开始轮询的时间戳基准
                });
                addLog(`成功加入房间: ${data.roomId}，我的ID: ${data.clientId}。Peers: ${get().peersInSignalRoom.join(', ') || '无'}`, '信令');
                showNotification('加入成功', `已加入房间 ${data.roomId}`, 'success');
                startPollingSignals();
                return true;
            } catch (error: any) {
                addLog(`加入房间 ${roomId} 失败: ${error.message}`, '错误');
                set({ isSignalSetup: false, isConnectingOrJoining: false, currentRoomId: null, myClientId: null }); // 清理状态
                showNotification('加入失败', `无法加入房间: ${error.message}`, 'error');
                return false;
            }
        },

        leaveRoom: async () => {
            const { apiBaseUrl, addLog, stopPollingSignals, myClientId, currentRoomId, closeP2PConnection } = get();
            if (!myClientId || !currentRoomId) {
                addLog('未在任何房间中或未初始化，无需离开。', 'API');
                return;
            }

            addLog(`尝试离开房间: ${currentRoomId}...`, 'API');
            stopPollingSignals(); // 先停止轮询
            if (get().isP2PConnected) {
                closeP2PConnection('离开房间');
            }

            try {
                // 即使请求失败，前端也应该清理状态
                await fetch(`${apiBaseUrl}/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId: currentRoomId, clientId: myClientId }),
                });
                addLog(`已发送离开房间 ${currentRoomId} 的请求。`, 'API');
            } catch (error: any) {
                addLog(`发送离开房间请求失败: ${error.message}`, '错误');
            } finally {
                // 清理本地状态
                set({
                    isSignalSetup: false,
                    myClientId: null,
                    currentRoomId: null,
                    peersInSignalRoom: [],
                    targetPeerIdForP2P: null,
                    isP2PConnected: false,
                    lastSignalTimestampProcessed: null,
                    // selectedFile 等文件状态可以不清，用户可能还想操作
                });
                peerConnectionInstance = null; // 清理 P2P 实例
                dataChannelInstance = null;
                addLog('已离开房间并清理本地状态。', '信令');
            }
        },

        sendApiSignal: async (signalRequest) => {
            const { apiBaseUrl, addLog, isSignalSetup, myClientId, currentRoomId } = get();
            if (!isSignalSetup || !myClientId || !currentRoomId) {
                addLog('信令未设置或未加入房间，无法发送信号。', '错误');
                return false;
            }
            if (signalRequest.roomId !== currentRoomId || signalRequest.senderId !== myClientId) {
                addLog('发送信号的房间或发送者ID与当前状态不匹配。', '错误');
                return false;
            }

            addLog(`发送API信号 (${signalRequest.type}) -> ${signalRequest.targetPeerId}: ${JSON.stringify(signalRequest.payload).substring(0, 50)}...`, 'API');
            try {
                const response = await fetch(`${apiBaseUrl}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(signalRequest),
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: '发送信号失败 (无法解析错误响应)' }));
                    throw new Error(errorData.message || `发送信号失败，HTTP状态码: ${response.status}`);
                }
                addLog(`API信号 (${signalRequest.type}) 发送成功。`, 'API');
                return true;
            } catch (error: any) {
                addLog(`发送API信号 (${signalRequest.type}) 失败: ${error.message}`, '错误');
                return false;
            }
        },

        _fetchSignals: async () => {
            const { apiBaseUrl, currentRoomId, myClientId, lastSignalTimestampProcessed, _handleReceivedApiSignal, addLog, isSignalSetup, isPolling } = get();

            if (!isSignalSetup || !currentRoomId || !myClientId || !isPolling) {
                // console.log('[Store _fetchSignals] Conditions not met for polling, skipping.');
                return;
            }

            // console.log(`[Store _fetchSignals] Polling for room ${currentRoomId} since ${lastSignalTimestampProcessed}`);
            try {
                const url = new URL(`${apiBaseUrl}/receive`); // 确保 apiBaseUrl 不以 / 结尾
                url.searchParams.append('roomId', currentRoomId);
                url.searchParams.append('clientId', myClientId); // 服务器可以用来过滤掉自己发送的消息（如果需要）
                if (lastSignalTimestampProcessed) {
                    url.searchParams.append('since', lastSignalTimestampProcessed.toString());
                }

                const response = await fetch(url.toString());

                if (response.status === 204) { // No Content
                    return;
                }
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: '获取信号时服务器响应错误' }));
                    throw new Error(errorData.message || `获取信号失败，HTTP状态码: ${response.status}`);
                }

                const signals = await response.json() as ApiSignal[];
                if (signals && signals.length > 0) {
                    addLog(`轮询：收到 ${signals.length} 条新API信号。`, 'API');
                    let maxTimestamp = lastSignalTimestampProcessed || 0;
                    signals.forEach(signal => {
                        // 确保不处理自己作为 senderId 的 peer_joined/peer_left (除非是服务器发的 room_state)
                        if ((signal.type === 'peer_joined' || signal.type === 'peer_left') && signal.senderId === myClientId) {
                            // console.log(`[Store _fetchSignals] Ignoring self-originated peer event: ${signal.type} for ${signal.senderId}`);
                        } else {
                            _handleReceivedApiSignal(signal);
                        }
                        if (signal.timestamp > maxTimestamp) {
                            maxTimestamp = signal.timestamp;
                        }
                    });
                    // 只更新时间戳，如果它确实前进了
                    if (maxTimestamp > (lastSignalTimestampProcessed || 0)) {
                        set({ lastSignalTimestampProcessed: maxTimestamp });
                    }
                }
            } catch (error: any) {
                addLog(`轮询信号失败: ${error.message}`, '错误');
                // 考虑是否在此处停止轮询，或增加错误计数器
                // get().stopPollingSignals();
                // get().showNotification('错误', '与信令服务器的通信可能中断。', 'error');
            }
        },

        startPollingSignals: () => {
            const { isPolling, pollingIntervalId, _fetchSignals, addLog, isSignalSetup } = get();
            if (!isSignalSetup) {
                addLog('信令未设置，无法启动轮询。', 'API');
                return;
            }
            if (isPolling && pollingIntervalId) {
                return; // 已在轮询
            }
            addLog('启动信号轮询...', 'API');
            _fetchSignals(); // 立即执行一次
            const newIntervalId = setInterval(() => {
                if (get().isSignalSetup && get().isPolling) { // 再次检查状态，确保在 interval 触发时仍然需要轮询
                    _fetchSignals();
                } else {
                    get().stopPollingSignals(); // 如果条件不满足，停止轮询
                }
            }, POLLING_INTERVAL) as unknown as number;
            set({ isPolling: true, pollingIntervalId: newIntervalId });
        },

        stopPollingSignals: () => {
            const { pollingIntervalId, addLog } = get();
            if (pollingIntervalId) {
                addLog('停止信号轮询。', 'API');
                clearInterval(pollingIntervalId);
                set({ isPolling: false, pollingIntervalId: null });
            }
        },

        _handleReceivedApiSignal: (signal) => {
            const { addLog, myClientId, peersInSignalRoom,
                _handleOfferViaApi, _handleAnswerViaApi, _handleCandidateViaApi,
                targetPeerIdForP2P, closeP2PConnection, showNotification, setTargetPeerIdForP2P } = get();

            if (!myClientId) return;

            // 避免处理自己发送的 offer/answer/candidate (这些是发给别人的)
            if ((signal.type === 'offer' || signal.type === 'answer' || signal.type === 'candidate') && signal.senderId === myClientId) {
                // console.log(`[Store _handleReceivedApiSignal] Ignoring self-sent signal: ${signal.type}`);
                return;
            }
            // 避免处理自己发送的 peer_joined/left (这些是由服务器确认或广播的)
            if ((signal.type === 'peer_joined' || signal.type === 'peer_left') && signal.payload.peerId === myClientId) {
                // console.log(`[Store _handleReceivedApiSignal] Ignoring self peer event: ${signal.type}`);
                return;
            }


            addLog(`处理API信号 (${signal.type}) 来自 ${signal.senderId || '服务器'}: ${JSON.stringify(signal.payload).substring(0, 50)}...`, '接收');

            switch (signal.type) {
                case 'connected_ack':
                    // 这个状态通常在 joinRoomAndSetupSignaling 中处理过了
                    // 但如果服务器单独推送这个，可以用来同步
                    if (signal.payload.clientId === myClientId) {
                        set(state => {
                            state.currentRoomId = signal.payload.roomId;
                            state.peersInSignalRoom = (signal.payload.peersInRoom || []).filter((p: string) => p !== myClientId);
                        });
                        addLog(`收到连接确认/房间状态。Peers: ${get().peersInSignalRoom.join(', ') || '无'}`, '信令');
                    }
                    break;
                case 'peer_joined':
                    if (signal.payload.peerId !== myClientId) {
                        addLog(`Peer ${signal.payload.peerId} 加入了房间。`, '信令');
                        set(state => {
                            if (!state.peersInSignalRoom.includes(signal.payload.peerId)) {
                                state.peersInSignalRoom = [...state.peersInSignalRoom, signal.payload.peerId];
                            }
                        });
                    }
                    break;
                case 'peer_left':
                    addLog(`Peer ${signal.payload.peerId} 离开了房间。`, '信令');
                    set(state => {
                        state.peersInSignalRoom = state.peersInSignalRoom.filter(p => p !== signal.payload.peerId);
                    });
                    if (targetPeerIdForP2P === signal.payload.peerId) {
                        addLog(`当前P2P目标 ${signal.payload.peerId} 已离开，关闭P2P连接。`, 'WebRTC');
                        closeP2PConnection('目标离开');
                        set({ targetPeerIdForP2P: null }); // 清空目标
                    }
                    break;
                case 'offer':
                    if (signal.senderId && signal.payload && signal.senderId !== myClientId) {
                        // 当收到 offer 时，通常意味着对方想与我建立连接
                        // 我们应该准备接受这个 offer，并将 offer 的发送者设为当前的 P2P 目标
                        addLog(`收到来自 ${signal.senderId} 的 Offer，准备处理...`, 'WebRTC');
                        if (get().isP2PConnected && get().targetPeerIdForP2P !== signal.senderId) {
                            closeP2PConnection('收到新的offer，覆盖旧连接');
                        }
                        setTargetPeerIdForP2P(signal.senderId); // 设定或更新P2P目标

                        if (!peerConnectionInstance || peerConnectionInstance.signalingState === 'closed') {
                            peerConnectionInstance = get()._createPeerConnection(signal.senderId);
                        }
                        if (peerConnectionInstance) {
                            _handleOfferViaApi(signal.payload as RTCSessionDescriptionInit, signal.senderId, peerConnectionInstance);
                        } else {
                            addLog('无法创建 PeerConnection 来处理 Offer。', '错误');
                        }
                    }
                    break;
                case 'answer':
                    if (signal.senderId && signal.payload && peerConnectionInstance && signal.senderId === get().targetPeerIdForP2P) {
                        _handleAnswerViaApi(signal.payload as RTCSessionDescriptionInit, signal.senderId, peerConnectionInstance);
                    }
                    break;
                case 'candidate':
                    if (signal.senderId && signal.payload && peerConnectionInstance && signal.senderId === get().targetPeerIdForP2P) {
                        _handleCandidateViaApi(signal.payload as RTCIceCandidateInit, signal.senderId, peerConnectionInstance);
                    }
                    break;
                case 'room_state':
                    set(state => {
                        state.peersInSignalRoom = (signal.payload.peersInRoom || []).filter((p: string) => p !== myClientId);
                    });
                    addLog(`收到房间状态更新。Peers: ${get().peersInSignalRoom.join(', ') || '无'}`, '信令');
                    break;
                case 'error':
                    addLog(`收到服务器错误信令: ${signal.payload.message}`, '错误');
                    showNotification('服务器消息', signal.payload.message, 'error');
                    break;
                default:
                    addLog(`收到未处理的API信号类型: ${(signal as any).type}`, '警告');
            }
        },

        setTargetPeerIdForP2P: (peerId) => {
            const { targetPeerIdForP2P: currentTarget, isP2PConnected, closeP2PConnection, addLog } = get();
            if (peerId === currentTarget && peerId !== null) return; // 如果目标未变且不是设为null，则不操作

            if (isP2PConnected && currentTarget !== peerId) { // 如果之前有连接并且目标变了，或者目标设为null
                addLog(`P2P 目标改变/取消，关闭旧连接 (原目标: ${currentTarget || '无'})。`, 'WebRTC');
                closeP2PConnection('切换/取消P2P目标');
            }
            set({ targetPeerIdForP2P: peerId });
            if (peerId) {
                addLog(`已选择 Peer ${peerId} 作为 P2P 通信目标。`, '日志');
            } else {
                addLog('已取消 P2P 通信目标选择。', '日志');
                // 如果取消目标时 P2P 仍然连接 (虽然理论上 closeP2PConnection 已处理)，再次确保
                if (get().isP2PConnected) set({ isP2PConnected: false });
            }
        },

        _createPeerConnection: (targetPeerId) => {
            const { addLog, showNotification, sendApiSignal, _setupDataChannelEvents, closeP2PConnection, currentRoomId, myClientId } = get();
            if (!myClientId || !currentRoomId) {
                addLog('无法创建PeerConnection：未加入房间或客户端ID未知。', '错误');
                return null;
            }
            addLog(`[Store _createPeerConnection] 创建到 Peer ${targetPeerId} 的 RTCPeerConnection...`, 'WebRTC');

            if (peerConnectionInstance && peerConnectionInstance.signalingState !== 'closed') {
                addLog('[Store _createPeerConnection] 已存在活动 PeerConnection，先关闭旧的。', 'WebRTC');
                closeP2PConnection('创建新PC前清理');
            }
            try {
                const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
                peerConnectionInstance = pc; // 在闭包中存储实例

                pc.onicecandidate = (event) => {
                    if (event.candidate && get().isSignalSetup) {
                        sendApiSignal({
                            type: 'candidate',
                            payload: event.candidate.toJSON(),
                            senderId: myClientId,
                            targetPeerId: targetPeerId,
                            roomId: currentRoomId,
                        });
                    }
                };
                pc.oniceconnectionstatechange = () => {
                    addLog(`[Store PC] ICE 连接状态: ${pc.iceConnectionState}`, 'WebRTC');
                };
                pc.onconnectionstatechange = () => {
                    addLog(`[Store PC] P2P 连接状态: ${pc.connectionState} (与 ${targetPeerId})`, 'WebRTC');
                    if (pc.connectionState === 'connected') {
                        set({ isP2PConnected: true });
                        showNotification('P2P 连接成功', `已与 ${targetPeerId} 建立P2P连接！`, 'success');
                    } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                        // 只有当不是我们主动关闭的时候才设置 isP2PConnected 为 false
                        // closeP2PConnection 会自己设置 isP2PConnected
                        if (peerConnectionInstance === pc) { // 确保是当前实例的状态变化
                            set({ isP2PConnected: false });
                            if (pc.connectionState !== 'closed') {
                                showNotification('P2P 连接中断', `与 ${targetPeerId} 的P2P连接已${pc.connectionState}。`, 'error');
                            }
                        }
                    }
                };
                pc.ondatachannel = (event) => {
                    addLog(`[Store PC] 收到来自 ${targetPeerId} 的 DataChannel: ${event.channel.label}`, 'WebRTC');
                    const dc = event.channel;
                    _setupDataChannelEvents(dc);
                    dataChannelInstance = dc; // 更新闭包中的实例
                };
                return pc;
            } catch (error) {
                addLog(`[Store _createPeerConnection] 创建 RTCPeerConnection 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                peerConnectionInstance = null;
                return null;
            }
        },

        _createDataChannel: (pc, label = "fileTransfer_http_signal") => {
            const { addLog, _setupDataChannelEvents } = get();
            addLog(`[Store _createDataChannel] 创建 DataChannel: "${label}"`, 'WebRTC');
            if (!pc || pc.signalingState === 'closed') {
                addLog('[Store _createDataChannel] PeerConnection 不存在或已关闭。', '错误');
                return null;
            }
            try {
                const dc = pc.createDataChannel(label, { ordered: true });
                _setupDataChannelEvents(dc);
                dataChannelInstance = dc; // 更新闭包中的实例
                return dc;
            } catch (e) {
                addLog(`[Store _createDataChannel] 创建 DataChannel "${label}" 失败: ${e instanceof Error ? e.message : String(e)}`, '错误');
                return null;
            }
        },

        _setupDataChannelEvents: (channel) => {
            const { addLog, showNotification, _revokeReceivedFileDownloadUrl } = get();
            channel.binaryType = 'arraybuffer';
            addLog(`[Store _setupDataChannelEvents] 为 DataChannel "${channel.label}" 设置事件监听器。`, 'WebRTC');

            channel.onopen = () => {
                addLog(`[Store DC ${channel.label}] P2P 数据通道已打开！`, 'WebRTC');
                // 清理上一次接收的文件状态
                set(state => {
                    state.receivingFileMetadata = null;
                    state.receivedFileChunks = [];
                    state.fileReceiveProgress = 0;
                });
            };
            channel.onclose = () => {
                addLog(`[Store DC ${channel.label}] P2P 数据通道已关闭。`, 'WebRTC');
                // dataChannelInstance = null; // 由 closeP2PConnection 清理
            };
            channel.onerror = (event) => {
                const errorEvent = event as RTCErrorEvent;
                addLog(`[Store DC ${channel.label}] P2P 数据通道发生错误: ${errorEvent.error?.message || JSON.stringify(event)}`, '错误');
            };
            channel.onmessage = (event: MessageEvent) => {
                addLog(`[Store DC ${channel.label}] 收到消息，类型: ${typeof event.data}`, '接收');
                if (typeof event.data === 'string') {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'file_metadata') {
                            const metadata = message.payload as FileMetadata;
                            addLog(`[Store DC] 收到文件元数据: ${metadata.name} (大小: ${metadata.size}, 总块数: ${metadata.totalChunks})`, '接收');
                            _revokeReceivedFileDownloadUrl(); // 清理上一个下载链接
                            set({
                                receivingFileMetadata: metadata,
                                receivedFileChunks: [],
                                fileReceiveProgress: 0,
                                lastReceivedFileData: null, // 清理上一个完成的文件
                                receivedFileDownloadUrl: null,
                            });
                        } else {
                            addLog(`[Store DC] DataChannel 收到文本: ${event.data.substring(0, 100)}...`, '接收');
                        }
                    } catch (e) {
                        addLog(`[Store DC] DataChannel 收到无法解析的文本: ${event.data.substring(0, 100)}...`, '接收');
                    }
                } else if (event.data instanceof ArrayBuffer) {
                    const currentReceivingMeta = get().receivingFileMetadata;
                    if (!currentReceivingMeta) {
                        addLog('[Store DC] 收到文件块但无元数据，已忽略。', '错误');
                        return;
                    }
                    const newChunks = [...get().receivedFileChunks, event.data];
                    const progress = Math.round((newChunks.length / currentReceivingMeta.totalChunks) * 100);
                    set({ receivedFileChunks: newChunks, fileReceiveProgress: progress });

                    if (newChunks.length === currentReceivingMeta.totalChunks) {
                        addLog(`[Store DC] 文件 "${currentReceivingMeta.name}" 所有块 (${newChunks.length}) 接收完毕！正在重组...`, 'WebRTC');
                        const fileBlob = new Blob(newChunks, { type: currentReceivingMeta.type });
                        const url = URL.createObjectURL(fileBlob);
                        set({
                            lastReceivedFileData: { blob: fileBlob, metadata: currentReceivingMeta },
                            receivedFileDownloadUrl: url,
                            // receivingFileMetadata: null, // 保留元数据显示文件名等
                            // receivedFileChunks: [], // 下次收到新元数据时会重置
                            fileReceiveProgress: 100
                        });
                        showNotification('文件接收成功', `文件 "${currentReceivingMeta.name}" 已接收。`, 'success');
                    }
                } else {
                    addLog(`[Store DC] DataChannel 收到未知类型数据: ${typeof event.data}`, '接收');
                }
            };
        },

        initiateP2PCall: async (targetPeerId) => {
            const { myClientId, currentRoomId, addLog, sendApiSignal, closeP2PConnection, _createPeerConnection, _createDataChannel, isSignalSetup, targetPeerIdForP2P: currentTarget, isP2PConnected } = get();

            if (!isSignalSetup || !myClientId || !currentRoomId) {
                addLog('信令未设置或未加入房间，无法发起呼叫。', '错误'); return;
            }
            if (targetPeerId === myClientId) {
                addLog('不能与自己建立 P2P 连接。', '错误'); return;
            }
            if (isP2PConnected && currentTarget === targetPeerId) {
                addLog(`已与 ${targetPeerId} 连接，无需重复发起。`, '日志'); return;
            }

            addLog(`向 ${targetPeerId} 发起 P2P 呼叫...`, 'WebRTC');
            // 在发起呼叫前，如果当前有与其他人的 P2P 连接，先断开
            if (isP2PConnected && currentTarget !== targetPeerId) {
                closeP2PConnection('切换P2P呼叫目标');
            }
            set({ targetPeerIdForP2P: targetPeerId }); // 确保 P2P 目标已更新

            const pc = _createPeerConnection(targetPeerId);
            if (!pc) { addLog('创建 PeerConnection 失败，无法发起呼叫。', '错误'); return; }

            const dc = _createDataChannel(pc);
            if (!dc) {
                addLog('创建 DataChannel 失败，无法发起呼叫。', '错误');
                closeP2PConnection('P2P呼叫时DC创建失败'); // 清理已创建的 PC
                return;
            }

            try {
                addLog('[Store] 正在创建 Offer...', 'WebRTC');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                addLog('[Store] Offer 已创建并设置本地描述，准备通过 API 发送...', 'WebRTC');
                const success = await sendApiSignal({
                    type: 'offer',
                    payload: { type: offer.type, sdp: offer.sdp },
                    senderId: myClientId,
                    targetPeerId: targetPeerId,
                    roomId: currentRoomId,
                });
                if (success) {
                    addLog('Offer 已通过 API 发送。', '发送');
                } else {
                    throw new Error('API 发送 Offer 失败');
                }
            } catch (error) {
                addLog(`创建或发送 Offer 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                closeP2PConnection('P2P呼叫时Offer失败');
            }
        },

        _handleOfferViaApi: async (offerSdp, senderId, pc) => {
            const { myClientId, currentRoomId, addLog, sendApiSignal, closeP2PConnection } = get();
            if (!myClientId || !currentRoomId) return; // 未初始化

            addLog(`[Store _handleOfferViaApi] 收到来自 ${senderId} 的 Offer，通过 API。`, 'WebRTC');
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
                addLog('[Store _handleOfferViaApi] 远程描述 (Offer) 已设置。正在创建 Answer...', 'WebRTC');
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                addLog('[Store _handleOfferViaApi] Answer 已创建并设置本地描述，准备通过 API 发送...', 'WebRTC');
                const success = await sendApiSignal({
                    type: 'answer',
                    payload: { type: answer.type, sdp: answer.sdp },
                    senderId: myClientId,
                    targetPeerId: senderId, // 回复给 Offer 的发送者
                    roomId: currentRoomId,
                });
                if (success) {
                    addLog('Answer 已通过 API 发送。', '发送');
                } else {
                    throw new Error('API 发送 Answer 失败');
                }
            } catch (error) {
                addLog(`处理 Offer 或创建/发送 Answer (API) 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                closeP2PConnection('Offer处理或Answer发送失败(API)');
            }
        },

        _handleAnswerViaApi: async (answerSdp, senderId, pc) => {
            const { addLog, closeP2PConnection } = get();
            addLog(`[Store _handleAnswerViaApi] 收到来自 ${senderId} 的 Answer，通过 API。`, 'WebRTC');
            if (!pc || pc.signalingState === 'closed') {
                addLog('[Store _handleAnswerViaApi] PeerConnection 不存在或已关闭。', '错误');
                return;
            }
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
                addLog('[Store _handleAnswerViaApi] 远程描述 (Answer) 已设置。P2P 连接应即将建立。', 'WebRTC');
            } catch (error) {
                addLog(`设置远程描述 (Answer API) 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
                closeP2PConnection('Answer处理失败(API)');
            }
        },

        _handleCandidateViaApi: async (candidateInit, senderId, pc) => {
            const { addLog } = get();
            addLog(`[Store _handleCandidateViaApi] 收到来自 ${senderId} 的 ICE Candidate，通过 API。PC状态: ${pc?.signalingState}`, 'WebRTC');

            if (!pc || pc.signalingState === 'closed') {
                addLog('[Store _handleCandidateViaApi] PeerConnection 无效或已关闭。', '错误');
                return;
            }

            // 尝试等待 remoteDescription 设置好
            if (!pc.remoteDescription) {
                addLog('[Store _handleCandidateViaApi] 远端描述尚未设置，等待100ms后重试...', '警告');
                await new Promise(resolve => setTimeout(resolve, 100)); // 等待 100ms
                if (!pc.remoteDescription) { // 再次检查
                    addLog('[Store _handleCandidateViaApi] 远端描述在等待后仍未设置，放弃添加此 Candidate。', '错误');
                    return;
                }
                 addLog('[Store _handleCandidateViaApi] 远端描述在等待后已设置。', '日志');
            }

            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
                addLog('[Store _handleCandidateViaApi] ICE Candidate 已添加。', 'WebRTC');
            } catch (error) {
                addLog(`添加 ICE Candidate (API) 失败: ${error instanceof Error ? error.message : String(error)}`, '错误');
            }
        },

        closeP2PConnection: (reason = '未知原因') => {
            const { addLog } = get();
            addLog(`[Store closeP2PConnection] 尝试关闭 P2P 连接... (原因: ${reason})`, 'WebRTC');

            if (dataChannelInstance) {
                if (dataChannelInstance.readyState === 'open' || dataChannelInstance.readyState === 'connecting') {
                    dataChannelInstance.close();
                }
                dataChannelInstance.onopen = null;
                dataChannelInstance.onclose = null;
                dataChannelInstance.onerror = null;
                dataChannelInstance.onmessage = null;
                dataChannelInstance = null; // 清理闭包中的引用
                addLog('[Store closeP2PConnection] DataChannel 已清理。', 'WebRTC');
            }
            if (peerConnectionInstance) {
                if (peerConnectionInstance.signalingState !== 'closed') {
                    peerConnectionInstance.close();
                }
                peerConnectionInstance.onicecandidate = null;
                peerConnectionInstance.oniceconnectionstatechange = null;
                peerConnectionInstance.onconnectionstatechange = null;
                peerConnectionInstance.ondatachannel = null;
                peerConnectionInstance = null; // 清理闭包中的引用
                addLog('[Store closeP2PConnection] PeerConnection 已清理。', 'WebRTC');
            }

            // 只有在确实是从连接状态变为非连接状态时才更新
            if (get().isP2PConnected) {
                set({
                    isP2PConnected: false,
                    // receivingFileMetadata: null, // 这些在 P2P 关闭时不一定需要重置，除非开始新的 P2P
                    // receivedFileChunks: [],
                    // fileReceiveProgress: 0,
                });
            }
            addLog(`[Store closeP2PConnection] P2P 连接资源已清理。 (原因: ${reason})`, 'WebRTC');
        },

        setSelectedFile: (file) => {
            set({ selectedFile: file, fileSendProgress: 0 }); // 选择新文件时重置进度
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
                addLog(`[Store] 文件元数据已发送: ${metadata.name}`, '发送');
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
                        reject(new Error('DataChannel closed during chunk read/send'));
                        return;
                    }
                    // 缓冲检查 (更细致的控制，防止发送过快导致DataChannel阻塞或崩溃)
                    if (dataChannelInstance.bufferedAmount > FILE_CHUNK_SIZE * 16) { // 例如，当缓冲区大于16个块大小时暂停
                        // addLog(`DataChannel buffer high (${dataChannelInstance.bufferedAmount}), pausing send...`, '日志');
                        setTimeout(() => resolve(readAndSendChunk()), 50); // 短暂延迟后重试
                        return;
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
                                reject(err_send);
                            }
                        } else {
                            reject(new Error('DataChannel closed during chunk send'));
                        }
                    };
                    reader.onerror = (e_onerror) => {
                        reject(reader.error);
                    };
                    reader.readAsArrayBuffer(slice);
                });
            };

            try {
                // 处理0字节文件
                if (selectedFile.size === 0) {
                    _setFileSendProgress(100);
                    addLog(`[Store] 文件 "${selectedFile.name}" 大小为0，标记为发送完成。`, '发送');
                    // 对于0字节文件，也发送一个完成信号或者空的metadata可能更好，取决于接收端如何处理。
                    // 这里简单地认为已完成。
                } else {
                    for (let i = 0; i < totalChunks; i++) {
                        if (!dataChannelInstance || dataChannelInstance.readyState !== 'open') {
                            throw new Error('DataChannel closed during file send loop');
                        }
                        await readAndSendChunk();
                    }
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
                showNotification('发送失败', `文件 "${selectedFile.name}" 未能成功发送。`, 'error');
                return false;
            }
        },

        _setIsP2PConnected: (connected) => set({ isP2PConnected: connected }),
        _setFileSendProgress: (progress) => set({ fileSendProgress: progress }),
        _setIsFileSending: (sending) => set({ isFileSending: sending }),

        cleanupStore: () => {
            const { stopPollingSignals, closeP2PConnection, _revokeReceivedFileDownloadUrl, addLog } = get();
            addLog('执行 Store 清理...', '日志');
            stopPollingSignals();
            closeP2PConnection('Store清理');
            _revokeReceivedFileDownloadUrl();
            // 清理闭包中的实例引用
            peerConnectionInstance = null;
            dataChannelInstance = null;
            // 可以选择是否重置所有状态到初始值
            set({
                isSignalSetup: false,
                myClientId: null,
                currentRoomId: null,
                peersInSignalRoom: [],
                isP2PConnected: false,
                targetPeerIdForP2P: null,
                // logs: [], // 是否清空日志可选
                // selectedFile: null, // 用户可能还想保留文件选择
            });
            addLog('Store 清理完成。', '日志');
        },
    }))
);