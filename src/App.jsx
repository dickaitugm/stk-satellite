import { useState } from 'react';

export default function App() {
  const [results, setResults] = useState('Menunggu data...');
  const [isLoading, setIsLoading] = useState(false);

  const handleGetHardwareInfo = async () => {
    setIsLoading(true);
    setResults('Memuat...');
    
    try {
      // Memanggil fungsi yang diekspos oleh preload.js
      const hardwareInfo = await window.electronAPI.getHardwareInfo();
      // Menampilkan hasil dalam format JSON yang mudah dibaca
      setResults(JSON.stringify(hardwareInfo, null, 2));
    } catch (error) {
      setResults(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-4">Informasi Hardware Komputer</h1>
        <p className="text-center mb-8">
          Klik tombol di bawah untuk mendapatkan ID unik dari hardware Anda.
        </p>
        
        <div className="text-center mb-6">
          <button 
            className={`btn btn-primary btn-lg ${isLoading ? 'loading' : ''}`}
            onClick={handleGetHardwareInfo}
            disabled={isLoading}
          >
            {isLoading ? 'Memuat...' : 'Dapatkan Info Hardware'}
          </button>
        </div>
        
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title text-xl mb-4">Hasil:</h3>
            <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
              {results}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}