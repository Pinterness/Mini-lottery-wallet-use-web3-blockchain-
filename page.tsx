"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogIn, Coins, Wallet, CheckCircle, RotateCcw, ShoppingBag, Send, Copy } from 'lucide-react';

const getEthersTools = () => {
    const Ethers = window.ethers; 

    if (!Ethers) {
        console.error("Ethers.js library not found in global scope (window.ethers). Please ensure the CDN is loaded.");
        return null;
    }
    
    // 2. Lấy các hàm/lớp cần thiết
    const BrowserProvider = Ethers.BrowserProvider;
    const Contract = Ethers.Contract;
    
    // Sử dụng formatEther và parseEther cho giao dịch Native Currency (ETH)
    const formatEther = Ethers.formatEther || Ethers.utils.formatEther;
    const parseEther = Ethers.parseEther || Ethers.utils.parseEther;

    return { BrowserProvider, Contract, formatEther, parseEther };
};

// --- CẤU HÌNH VÀ DỮ LIỆU CẦN THIẾT ---

// Địa chỉ Contract (CẬP NHẬT ĐỊA CHỈ THỰC TẾ CỦA BẠN SAU KHI DEPLOY)
const LOTTERY_CONTRACT_ADDRESS = '0x9E8D7C6B5A4F3E2D1C0B9A8F7E6D5C4B3A2C1B0A'; // PLACEHOLDER: Địa chỉ Lottery Contract
const TICKET_PRICE = 0.005; // Giá vé: 0.005 ETH

// ABI CỦA CONTRACTS
// Lottery Contract hiện cần hàm buyTicket là 'payable' để nhận ETH.
const LotteryAbi = [
    "function currentRound() view returns (uint256)",
    "function getTicketsInCurrentRound() view returns (tuple(address owner, uint256 number)[] )",
    "function getLotteryHistory(uint256 roundId) view returns (tuple(uint256 winningNumber, address winner))",
    "function buyTicket(uint256 ticketNumber) external payable", // PHẢI LÀ PAYABLE
    "function drawLottery() external"
];

// --- HÀM HỖ TRỢ ---
const chainName = (id) => {
    if (!id) return "Unknown";
    if (id === 1) return "Ethereum Mainnet";
    if (id === 11155111) return "Sepolia Testnet";
    return `Chain ${id}`;
};

const shortAddress = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Chưa kết nối");

// --- REACT COMPONENT CHÍNH ---

export default function App() {
    // 1. STATE QUẢN LÝ WEB3 
    const [wallet, setWallet] = useState(null);
    const [ethBalance, setEthBalance] = useState(null); 
    const [chainId, setChainId] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    
    // Ethers.js States
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [lotteryContract, setLotteryContract] = useState(null);

    // 2. STATE QUẢN LÝ DAPP
    const [currentRound, setCurrentRound] = useState(0);
    const [tickets, setTickets] = useState([]); 
    const [history, setHistory] = useState([]); 
    const [userTickets, setUserTickets] = useState([]); 
    const [selectedNumbers, setSelectedNumbers] = useState(Array(5).fill(null));
    const [isDrawing, setIsDrawing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    // Lấy các hàm Ethers.js (Giả định Ethers đã được tải)
    // Cần đảm bảo rằng các biến này được lấy ra an toàn
    const ethersTools = useMemo(() => getEthersTools(), []);
    
    // Sử dụng optional chaining để an toàn hơn
    const BrowserProvider = ethersTools?.BrowserProvider;
    const Contract = ethersTools?.Contract;
    const formatEther = ethersTools?.formatEther;
    const parseEther = ethersTools?.parseEther;

    // --- HÀM QUẢN LÝ VÍ ---
    const refreshAccount = useCallback(async (a) => {
        // Kiểm tra an toàn trước khi gọi
        if (!window.ethereum || !BrowserProvider || !formatEther) {
             console.log("Ethers tools not ready for refreshAccount.");
             return;
        }
        try {
            const currentProvider = new BrowserProvider(window.ethereum);
            
            // Lấy số dư ETH (Native Token)
            const ethBal = await currentProvider.getBalance(a);
            setEthBalance(Number(formatEther(ethBal))); // Chuyển sang Number để dễ format

            // Lấy Chain ID
            const network = await currentProvider.getNetwork();
            setChainId(Number(network.chainId));

        } catch (err) {
            console.error("refreshAccount err:", err);
            setEthBalance(null);
        }
    }, [BrowserProvider, formatEther]);

    const connectWallet = useCallback(async () => {
        setMessage(null);
        if (!window.ethereum) {
            setMessage("MetaMask chưa được cài đặt. Vui lòng cài MetaMask extension.");
            return;
        }
        if (!BrowserProvider) {
            setMessage("Lỗi thư viện Ethers.js không khả dụng. Vui lòng tải lại trang.");
            return;
        }

        setIsConnecting(true);
        try {
            const web3Provider = new BrowserProvider(window.ethereum);
            
            await web3Provider.send("eth_requestAccounts", []);
            
            const currentSigner = await web3Provider.getSigner();
            const userAddress = await currentSigner.getAddress();

            setProvider(web3Provider);
            setSigner(currentSigner);
            setWallet(userAddress);

            setMessage(`Kết nối thành công! Ví: ${shortAddress(userAddress)}`);
            
        } catch (err) {
            console.error("Lỗi Web3 Connect:", err);
            setMessage(`Lỗi kết nối ví: ${(err.message || "Unknown Error").substring(0, 100)}`);
        } finally {
            setIsConnecting(false);
        }
    }, [BrowserProvider]);
    
    const disconnect = useCallback(() => {
        setWallet(null);
        setEthBalance(null);
        setChainId(null);
        setProvider(null);
        setSigner(null);
        setLotteryContract(null);
        setMessage('Đã ngắt kết nối ví.');
    }, []);

    const copyAddress = useCallback(async () => {
        if (!wallet) return;
        try {
            // Sử dụng document.execCommand('copy') thay vì navigator.clipboard.writeText()
            // để đảm bảo tương thích trong môi trường iFrame/Canvas
            const tempInput = document.createElement('textarea');
            tempInput.value = wallet;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);

            setMessage(`Đã copy địa chỉ ${shortAddress(wallet)} vào clipboard.`);
        } catch {
            setMessage("Không thể copy địa chỉ. Vui lòng thử lại.");
        }
    }, [wallet]);


    // --- HÀM DAPP LOGIC ---
    const initContracts = useCallback(() => {
        if (!provider || !Contract) return;
        try {
            // Chỉ cần khởi tạo Lottery Contract
            const lottery = new Contract(LOTTERY_CONTRACT_ADDRESS, LotteryAbi, signer || provider);
            setLotteryContract(lottery);

            console.log("Lottery Contract initialized successfully.");

        } catch (error) {
            console.error("Error initializing contracts (Check ABI/Addresses):", error);
            setMessage('Lỗi khởi tạo Smart Contract. Vui lòng kiểm tra địa chỉ và ABI.');
        }
    }, [provider, signer, Contract]);

    const fetchDappState = useCallback(async () => {
        if (!wallet || !lotteryContract) return;
        setIsLoading(true);

        try {
            await refreshAccount(wallet); 

            // 1. Lấy Vòng hiện tại
            const round = await lotteryContract.currentRound();
            const roundNumber = Number(round);
            setCurrentRound(roundNumber); 
            
            // 2. Lấy Tickets Vòng hiện tại
            const currentTickets = await lotteryContract.getTicketsInCurrentRound();
            
            const mappedTickets = currentTickets.map((t, index) => ({
                id: index,
                round: roundNumber,
                number: String(t.number).padStart(5, '0'), 
                ownerAddress: t.owner,
            }));

            setTickets(mappedTickets);
            
            const ownedTickets = mappedTickets.filter(t => t.ownerAddress.toLowerCase() === wallet.toLowerCase());
            setUserTickets(ownedTickets);

            // 3. Lấy Lịch sử
            if (roundNumber > 1) {
                const lastDrawResult = await lotteryContract.getLotteryHistory(roundNumber - 1);
                setHistory([{
                    round: roundNumber - 1,
                    winningNumber: String(lastDrawResult.winningNumber).padStart(5, '0'),
                    winner: lastDrawResult.winner,
                    timestamp: Date.now(), 
                    totalTickets: 10, 
                }]);
            }

        } catch (error) {
            console.error("Error fetching DApp state:", error);
            setMessage('Lỗi khi đọc dữ liệu từ Smart Contract. Đã triển khai đúng mạng chưa?');
        } finally {
            setIsLoading(false);
        }
    }, [wallet, lotteryContract, refreshAccount]);

    const handleNumberSelect = useCallback((index, value) => {
        if (value >= 0 && value <= 9) {
            setSelectedNumbers(prevNumbers => {
                const newNumbers = [...prevNumbers];
                newNumbers[index] = value;
                return newNumbers;
            });
        }
    }, []);

    const handleBuyTicket = async () => {
        // Kiểm tra an toàn trước khi gọi
        if (!wallet || !signer || !lotteryContract || !parseEther) {
            setMessage('Vui lòng kết nối ví và đảm bảo contract đã sẵn sàng (Ethers.js chưa tải?).');
            return;
        }

        const numbersArray = selectedNumbers.map(n => n === null ? '0' : n.toString());
        const ticketNumberStr = numbersArray.join('');
        const ticketNumberInt = parseInt(ticketNumberStr);

        if (numbersArray.some(n => n === null || n.length === 0 || isNaN(n))) {
            setMessage('Vui lòng chọn đủ 5 số hợp lệ cho vé (từ 0 đến 9).');
            return;
        }

        try {
            setIsLoading(true);
            
            // B1: TÍNH TOÁN GIÁ TRỊ ETH (không cần Approve)
            // parseEther sử dụng 18 decimals (chuẩn của ETH)
            const amountToSend = parseEther(TICKET_PRICE.toString());
            
            setMessage(`Đang gửi giao dịch mua vé số ${ticketNumberStr} với ${TICKET_PRICE} ETH...`);

            // B2: CALL HÀM MUA VÉ VỚI TÙY CHỌN { value: amountToSend }
            // Contract buyTicket PHẢI là 'payable'
            const buyTx = await lotteryContract.connect(signer).buyTicket(ticketNumberInt, { value: amountToSend }); 
            await buyTx.wait();

            setMessage(`Mua vé số ${ticketNumberStr} thành công! Vui lòng làm mới trang hoặc đợi DApp cập nhật.`);
            setSelectedNumbers(Array(5).fill(null)); 
            
            setTimeout(() => fetchDappState(), 3000); 

        } catch (error) {
            console.error("Lỗi giao dịch Web3:", error);
            // Dùng logic để phân biệt giữa lỗi người dùng từ chối và lỗi contract revert (thường khó trong Ethers.js)
            if (error.code === 4001) { // Lỗi người dùng từ chối giao dịch
                 setMessage('Giao dịch đã bị người dùng từ chối.');
            } else {
                 setMessage('Lỗi giao dịch Web3. Đã có đủ ETH chưa? (Transaction Reverted).');
            }
           
        } finally {
            setIsLoading(false);
        }
    };

    const triggerDraw = useCallback(async () => {
        // Tạm thời giới hạn quay số chỉ cho ví đã mua vé. 
        // Trong thực tế, hàm này thường chỉ được gọi bởi Owner hoặc qua Chainlink VRF.
        if (isDrawing || tickets.length < 10 || !signer || !lotteryContract) return;

        setIsDrawing(true);
        setMessage('Đang gọi Smart Contract để kích hoạt quay số...');

        try {
            const drawTx = await lotteryContract.connect(signer).drawLottery();
            await drawTx.wait();
            
            setMessage('Quay số thành công! Dữ liệu sẽ được cập nhật sau vài giây.');
            setTimeout(() => fetchDappState(), 5000);

        } catch (error) {
             console.error("Lỗi giao dịch Quay số:", error);
             setMessage('Lỗi khi kích hoạt quay số Smart Contract.');
        } finally {
            setIsDrawing(false);
        }
    }, [isDrawing, tickets.length, signer, lotteryContract, fetchDappState]);


    // --- EFFECTS: Lắng nghe trạng thái và fetch dữ liệu ---
    useEffect(() => {
        if (signer && wallet) {
            initContracts();
            refreshAccount(wallet);
        }
    }, [signer, wallet, initContracts, refreshAccount]);

    useEffect(() => {
        if (wallet && lotteryContract) {
            fetchDappState();
            const intervalId = setInterval(() => fetchDappState(), 30000);
            return () => clearInterval(intervalId);
        }
    }, [wallet, lotteryContract, fetchDappState]);

    useEffect(() => {
        if (!window.ethereum) return;
        
        const handleAccountsChanged = (accounts) => {
            const newAccount = Array.isArray(accounts) ? accounts[0] : accounts?.accounts?.[0];
            if (newAccount) {
                setWallet(newAccount);
                setMessage(`Đã chuyển sang ví: ${shortAddress(newAccount)}`);
            } else {
                disconnect();
            }
        };

        const handleChainChanged = (chainHex) => {
            const cid = Number(chainHex);
            setChainId(cid);
            setMessage(`Đã chuyển mạng: ${chainName(cid)}`);
        };

        if (window.ethereum?.on) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
        }
        
        return () => {
            if (window.ethereum?.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [disconnect]);


    // --- UI Components ---
    
    const TicketSelection = ({ numbers, onSelect }) => (
        <div className="flex justify-center space-x-2">
            {numbers.map((num, index) => (
                <div key={index} className="flex flex-col items-center">
                    <span className="text-xs text-gray-400 mb-1">Digit {index + 1}</span>
                    <input
                        type="number"
                        min="0"
                        max="9"
                        value={num === null ? '' : num}
                        onChange={(e) => onSelect(index, parseInt(e.target.value))}
                        className="w-10 h-10 text-xl text-center bg-gray-700 border border-yellow-500 rounded-lg focus:ring-2 focus:ring-yellow-400 transition-all duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="?"
                    />
                </div>
            ))}
        </div>
    );

    const LotterySpinner = useMemo(() => {
        const lastDraw = history.length > 0 ? history[0] : null;
        const displayNumbers = lastDraw ? lastDraw.winningNumber.split('') : ['?', '?', '?', '?', '?'];

        return (
            <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700 mb-8">
                <h2 className="text-2xl font-bold mb-4 text-center text-white">
                    {isDrawing || isLoading ? "ĐANG TẢI DỮ LIỆU CHUỖI..." : `VÒNG HIỆN TẠI: #${currentRound}`}
                </h2>
                <div className="flex justify-center space-x-4">
                    {displayNumbers.map((num, index) => (
                        <div key={index} className={`w-14 h-14 md:w-20 md:h-20 flex items-center justify-center text-4xl md:text-6xl font-extrabold rounded-xl shadow-lg transition-all duration-300 ${
                            isDrawing ? 'bg-gradient-to-r from-red-500 to-yellow-500 animate-pulse' : 'bg-gradient-to-br from-gray-900 to-gray-700 text-yellow-400'
                        }`}>
                            {isDrawing ? <RotateCcw className="animate-spin text-white" size={32} /> : num}
                        </div>
                    ))}
                </div>
                {lastDraw && !isDrawing && (
                    <p className="text-center text-sm mt-4 text-green-400">
                        Số trúng vòng trước: **{lastDraw.winningNumber}**
                    </p>
                )}
            </div>
        );
    }, [history, isDrawing, currentRound, isLoading]);

    const Card = ({ title, children, className = '' }) => (
        <div className={`bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 ${className}`}>
            <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2 text-yellow-400">{title}</h3>
            {children}
        </div>
    );

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-gray-900 text-white font-inter">
            {/* Kiểm tra Ethers.js */}
            {!ethersTools && (
                <div className="fixed inset-0 z-50 bg-red-900/90 flex flex-col items-center justify-center p-4">
                    <h1 className="text-3xl font-bold text-white mb-4">Lỗi: Thư viện Web3 chưa sẵn sàng</h1>
                    <p className="text-red-200 text-center">
                        Ứng dụng này yêu cầu **Ethers.js (v6)** được tải từ CDN vào biến toàn cục `window.ethers` trước khi React khởi tạo. <br/>
                        Vui lòng đảm bảo đã thêm CDN sau vào thẻ &lt;head&gt; của trang HTML:
                        <code className="block mt-3 bg-red-800 p-2 rounded-lg text-sm">
                            &lt;script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js"&gt;&lt;/script&gt;
                        </code>
                    </p>
                </div>
            )}
            
            {/* Header / Navigation Bar */}
            <header className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur-sm shadow-lg border-b border-gray-700 p-4 flex justify-between items-center">
                <h1 className="text-2xl font-extrabold text-yellow-500 flex items-center">
                    <Coins className="mr-2" /> Sepolia ETH Lottery DApp
                </h1>
                <div className="flex items-center space-x-3">
                    {wallet && (
                        <>
                            <div className="flex flex-col items-end bg-gray-700 p-2 rounded-lg text-sm font-medium">
                                <span className="text-xs text-gray-400">{chainName(chainId)}</span>
                                <span className="font-bold text-green-400">{ethBalance ? ethBalance.toFixed(4) : "..."} ETH</span>
                            </div>
                            <button
                                onClick={copyAddress}
                                className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all duration-300"
                                title="Copy Address"
                            >
                                <Copy size={18} className="text-yellow-400" />
                            </button>
                            <button
                                onClick={disconnect}
                                className="py-2 px-4 rounded-lg font-medium bg-red-600 hover:bg-red-700 transition-all duration-300 flex items-center"
                            >
                                <LogIn size={18} className="mr-2 rotate-180" />
                                Disconnect
                            </button>
                        </>
                    )}
                    {!wallet && (
                        <button
                            onClick={connectWallet}
                            disabled={isConnecting || !ethersTools}
                            className={`py-2 px-4 rounded-lg font-medium transition-all duration-300 flex items-center ${
                                isConnecting ? 'bg-gray-600' : 'bg-yellow-600 hover:bg-yellow-700'
                            }`}
                            title={'Kết nối ví'}
                        >
                            <LogIn size={18} className="mr-2" />
                            {isConnecting ? 'Đang kết nối...' : 'Kết nối Ví MetaMask'}
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-4 md:p-8">
                {/* Global Message Alert */}
                {message && (
                    <div className="bg-blue-600/20 text-blue-300 p-3 rounded-xl mb-6 flex items-center shadow-lg border border-blue-600">
                        <CheckCircle size={20} className="mr-3 min-w-5" />
                        {message}
                    </div>
                )}
                
                {/* Connection Check */}
                {!wallet && (
                    <div className="bg-red-900/40 border border-red-700 p-6 rounded-2xl text-center mb-8">
                        <h2 className="text-2xl font-bold text-red-300 mb-4">Vui lòng kết nối ví</h2>
                        <p className="text-red-200 mb-6">Bạn cần kết nối ví MetaMask trên mạng Sepolia để tương tác với DApp.</p>
                        <button
                            onClick={connectWallet}
                            disabled={isConnecting || !ethersTools}
                            className={`px-6 py-3 rounded-lg font-bold text-lg transition-all duration-300 ${
                                isConnecting ? 'bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {isConnecting ? 'Đang kết nối...' : 'Kết nối MetaMask'}
                        </button>
                    </div>
                )}
                
                {wallet && (
                    <div className="space-y-8">
                        {/* Top Section: Spinner and Stats */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2">
                                {LotterySpinner}
                                <Card title="Tình trạng Vòng Quay Hiện Tại (Smart Contract)" className="mt-8">
                                    <div className="flex justify-between text-lg font-medium">
                                        <p className="text-gray-400">Vé đã mua:</p>
                                        <p className={`font-bold ${tickets.length >= 10 ? 'text-red-500' : 'text-yellow-400'}`}>{tickets.length} / 10</p>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                                        <div className="bg-yellow-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(tickets.length * 10, 100)}%` }}></div>
                                    </div>
                                    <p className="text-sm mt-3 text-gray-500">Mỗi 10 vé sẽ tự động quay số.</p>
                                    
                                    {tickets.length >= 10 && (
                                        <div className="mt-4 pt-4 border-t border-gray-700">
                                            <button
                                                onClick={triggerDraw}
                                                disabled={isDrawing || tickets.length < 10 || isLoading}
                                                className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold disabled:bg-gray-600 flex items-center justify-center"
                                            >
                                                <RotateCcw size={18} className="mr-2" />
                                                {isDrawing ? 'Đang quay số...' : 'Kích Hoạt Quay Số'}
                                            </button>
                                        </div>
                                    )}

                                </Card>
                            </div>

                            {/* Contract Info */}
                            <Card title="Thông tin Contracts Testnet">
                                <p className="mb-2"><span className="text-gray-400">Đơn vị tiền tệ:</span> Sepolia ETH</p>
                                <p className="mb-2"><span className="text-gray-400">Giá vé:</span> {TICKET_PRICE} ETH</p>
                                <p className="break-all text-sm"><span className="text-gray-400">Địa chỉ Lottery:</span> <span className="text-yellow-500">{shortAddress(LOTTERY_CONTRACT_ADDRESS)}</span></p>
                            </Card>
                        </div>

                        {/* Middle Section: Buy Ticket and User Tickets */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Buy Ticket Container */}
                            <div className="lg:col-span-2">
                                <Card title={`Mua Vé Số (Giá: ${TICKET_PRICE} ETH) - Giao dịch Web3`}>
                                    <p className="mb-4 text-gray-400">Chọn 5 số bất kỳ từ 0 đến 9. Chỉ cần ký **1 giao dịch** mua vé.</p>
                                    <TicketSelection numbers={selectedNumbers} onSelect={handleNumberSelect} />
                                    <button
                                        onClick={handleBuyTicket}
                                        disabled={selectedNumbers.some(num => num === null || isNaN(num)) || isLoading}
                                        className="w-full mt-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-lg transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <ShoppingBag size={20} className="mr-2" />
                                        {isLoading ? 'Đang chờ xác nhận...' : `Mua Vé (${selectedNumbers.map(n => n === null ? '?' : n).join('')})`}
                                    </button>
                                </Card>
                            </div>

                            {/* User Tickets and Resale */}
                            <Card title="Vé Của Tôi (Lấy từ Smart Contract)">
                                {userTickets.length === 0 ? (
                                    <p className="text-gray-500">Bạn chưa mua vé nào trong vòng này.</p>
                                ) : (
                                    <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                        {userTickets.map((ticket) => (
                                            <li key={`${ticket.round}-${ticket.number}`} className="bg-gray-700 p-3 rounded-lg flex justify-between items-center transition-transform hover:scale-[1.02]">
                                                <div className="font-mono text-xl text-yellow-300">
                                                    {ticket.number} <span className="text-xs text-gray-400"> (Vòng #{ticket.round})</span>
                                                </div>
                                                <button
                                                    onClick={() => setMessage(`Mô phỏng: Tạo giao dịch bán lại vé số ${ticket.number} (chưa được triển khai).`)}
                                                    className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded-md flex items-center"
                                                >
                                                    <Send size={14} className="mr-1" /> Bán Lại
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>

                        {/* Bottom Section: Lottery History */}
                        <Card title="Lịch Sử Quay Số (Lấy từ Smart Contract)">
                            {history.length === 0 ? (
                                <p className="text-gray-500">Chưa có kết quả quay số nào.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-left text-sm">
                                        <thead className="text-xs uppercase bg-gray-700 text-gray-400">
                                            <tr>
                                                <th scope="col" className="px-6 py-3">Vòng</th>
                                                <th scope="col" className="px-6 py-3">Số Trúng</th>
                                                <th scope="col" className="px-6 py-3">Người Thắng (Địa chỉ)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map((item) => (
                                                <tr key={item.round} className="border-b border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-yellow-300">#{item.round}</td>
                                                    <td className="px-6 py-4 font-mono text-xl text-green-400">{item.winningNumber}</td>
                                                    <td className="px-6 py-4 font-mono text-xs">{shortAddress(item.winner)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}
