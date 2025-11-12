import { ipcMain } from 'electron';
import axios from 'axios';
import si from 'systeminformation';

export function registerIpcHandlers() {
  ipcMain.handle('get-hardware-info', async () => {
    try {
      // Fungsi untuk mendapatkan public IP
      const getPublicIp = async () => {
        try {
          const response = await axios.get('https://api.ipify.org?format=json');
          return response.data.ip;
        } catch (error) {
          return error.message;
        }
      };

      // Panggil semua promise secara bersamaan untuk efisiensi
      const [
        publicIp,
        boardData,
        cpuData,
        diskData,
        netData // Objek ini sudah berisi IP lokal dan MAC address
      ] = await Promise.all([
        getPublicIp(),
        si.baseboard(),
        si.cpu(),
        si.diskLayout(),
        si.networkInterfaces('default')
      ]);

      return {
        publicIp: publicIp,
        localIp: netData.ip4, // <-- Tambahan baru di sini
        motherboardSerial: boardData.serial,
        cpuSignature: cpuData.signature,
        diskSerial: diskData.length > 0 ? diskData[0].serialNum : 'N/A',
        macAddress: netData.mac
      };

    } catch (e) {
      console.error(e);
      return { error: e.message };
    }
  });
}