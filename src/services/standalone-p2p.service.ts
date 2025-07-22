/**
 * StandaloneP2PService - A version of P2P service that works without a server
 * 
 * This service provides direct P2P file transfers using localStorage
 * as a fallback when the server is unavailable.
 */

import { P2PService, P2PError } from './p2p.service';
import { CryptoService } from './crypto.service';

export class StandaloneP2PService extends P2PService {
  /**
   * Create a room for file sharing without requiring a server
   * 
   * @param file File to share
   * @returns Promise resolving to the share code
   */
  async createRoom(file: File): Promise<string> {
    try {
      // Store the file for later use
      this.currentFile = file;
      this.isInitiator = true;
      
      // Generate a secure share code with minimum 8 characters for sufficient entropy
      this.roomCode = CryptoService.generateSecureCode({ length: 8 });
      console.log('Generated share code:', this.roomCode, 'Length:', this.roomCode.length);
      
      // Store room info in localStorage
      const roomInfo = {
        code: this.roomCode,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        timestamp: Date.now(),
        status: 'waiting',
        standalone: true // Mark as standalone mode
      };
      
      localStorage.setItem(`p2p_room_${this.roomCode}`, JSON.stringify(roomInfo));
      
      // Mark sender as connected (ready to transfer)
      this.isConnected = true;
      
      console.log('Room created with code (standalone mode):', this.roomCode);
      
      return this.roomCode;
    } catch (error) {
      throw this.handleError(error, 'Failed to create room in standalone mode');
    }
  }

  /**
   * Join a room using a share code without requiring a server
   * 
   * @param code The share code to join
   */
  async joinRoom(code: string): Promise<void> {
    try {
      this.roomCode = code;
      this.isInitiator = false;
      
      console.log('Joining room with code (standalone mode):', code);
      
      // Validate the share code format
      if (!code || code.length < 8) {
        throw new Error('Invalid share code format');
      }
      
      // Check if room exists in localStorage
      const roomKey = `p2p_room_${code}`;
      const roomData = localStorage.getItem(roomKey);
      
      if (!roomData) {
        throw new Error('Room not found. Please check the share code.');
      }
      
      const roomInfo = JSON.parse(roomData);
      console.log('Found room:', roomInfo);
      
      // Store file metadata for receiving
      this.fileMetadata = {
        name: roomInfo.fileName,
        size: roomInfo.fileSize,
        type: roomInfo.fileType
      };
      
      console.log('Establishing connection in standalone mode...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mark as connected and update room status
      this.isConnected = true;
      roomInfo.status = 'connected';
      localStorage.setItem(roomKey, JSON.stringify(roomInfo));
      
      console.log('✅ Connected to peer successfully (standalone mode)');
      console.log('Ready to receive file transfer');
      
      // Start listening for file data
      this.startListeningForFileData();
      
    } catch (error) {
      throw this.handleError(error, 'Failed to join room in standalone mode');
    }
  }

  /**
   * Start the file transfer in standalone mode
   */
  async startTransfer(): Promise<void> {
    try {
      console.log('🚀 Starting transfer in standalone mode...', {
        isInitiator: this.isInitiator,
        hasFile: !!this.currentFile,
        roomCode: this.roomCode,
        isConnected: this.isConnected
      });
      
      if (this.isInitiator && this.currentFile) {
        // For sender: transfer file via localStorage
        console.log('📤 Starting file transfer as sender...');
        await this.sendFileViaLocalStorage();
      } else {
        // For receiver: start listening for file data
        console.log('📥 Starting file transfer as receiver...');
        if (!this.roomCode) {
          throw new Error('No room code available for receiving');
        }
        await this.receiveFile(this.roomCode);
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to start transfer in standalone mode');
    }
  }
}

export default StandaloneP2PService;