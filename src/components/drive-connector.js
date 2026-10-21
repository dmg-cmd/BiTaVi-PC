/**
 * Conector oficial de Google Drive para BiTaVi PC
 * Utiliza Google Identity Services (OAuth 2.0) y Google Drive API v3
 */
export class GoogleDriveConnector {
  constructor(onFileDownloaded, onStatusUpdate) {
    this.onFileDownloaded = onFileDownloaded;
    this.onStatusUpdate = onStatusUpdate;
    this.tokenClient = null;
    this.accessToken = null;
    this.clientId = localStorage.getItem('bitavi_gdrive_client_id') || '';
    this.isGapiLoaded = false;
    this.isGsiLoaded = false;
    this.downloadAbortController = null;
  }

  saveCredentials(clientId) {
    this.clientId = clientId.trim();
    localStorage.setItem('bitavi_gdrive_client_id', this.clientId);
  }

  loadGoogleScripts() {
    return new Promise((resolve) => {
      if (!window.gapi) {
        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.onload = () => {
          window.gapi.load('client:picker', () => {
            this.isGapiLoaded = true;
            checkReady();
          });
        };
        document.body.appendChild(script1);
      } else {
        this.isGapiLoaded = true;
      }

      if (!window.google || !window.google.accounts) {
        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.onload = () => {
          this.isGsiLoaded = true;
          checkReady();
        };
        document.body.appendChild(script2);
      } else {
        this.isGsiLoaded = true;
      }

      const checkReady = () => {
        if (this.isGapiLoaded && this.isGsiLoaded) {
          resolve(true);
        }
      };

      if (this.isGapiLoaded && this.isGsiLoaded) resolve(true);
    });
  }

  async authenticate() {
    await this.loadGoogleScripts();

    if (!this.clientId) {
      throw new Error('Se requiere configurar el Client ID de Google Cloud Console.');
    }

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response) => {
            if (response.error !== undefined) {
              reject(response);
              return;
            }
            this.accessToken = response.access_token;
            console.log('[GDrive] Token obtenido:', this.accessToken ? this.accessToken.substring(0, 20) + '...' : 'null');
            resolve(this.accessToken);
          },
        });

        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err) {
        reject(err);
      }
    });
  }

  async ensureAuthenticated() {
    if (!this.accessToken) {
      console.log('[GDrive] Sin token, autenticando...');
      await this.authenticate();
      return;
    }
    try {
      const verifyResp = await fetch('https://www.googleapis.com/drive/v3/about', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!verifyResp.ok) {
        console.warn('[GDrive] Token inválido o expirado, re-autenticando...', verifyResp.status);
        await this.authenticate();
      }
    } catch (e) {
      console.warn('[GDrive] Error verificando token, re-autenticando...', e);
      await this.authenticate();
    }
  }

  async listBiTaViBackups() {
    await this.ensureAuthenticated();

    this.onStatusUpdate?.('🔍 Consultando archivos de backup en tu Google Drive...');

    const query = "mimeType = 'application/zip' or name contains '.zip' or name contains 'bitavi' or name contains 'BiTaVi'";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime,mimeType,iconLink)&pageSize=25`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en Drive API: ${errorText}`);
    }

    const data = await response.json();
    return data.files || [];
  }

  async downloadZipFile(fileId, fileName, onProgress, knownSizeBytes = null) {
    await this.ensureAuthenticated();

    this.onStatusUpdate?.(`📥 Iniciando descarga de ${fileName}...`);
    console.log('[GDrive] Iniciando descarga:', fileName, 'ID:', fileId);

    const totalBytes = knownSizeBytes ? parseInt(knownSizeBytes, 10) : 0;
    const initialTotalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '--';
    onProgress?.({ percent: 0, loadedMb: '0.0', totalMb: initialTotalMb, phase: 'Iniciando conexión segura...' });
    this.onStatusUpdate?.(`📥 Iniciando descarga de ${fileName}...`);

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    this.downloadAbortController = new AbortController();
    const timeoutMs = 300000;
    const timeoutId = setTimeout(() => {
      this.downloadAbortController.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        signal: this.downloadAbortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GDrive] Error en respuesta:', response.status, response.statusText, errorText);
        throw new Error(`Error descargando archivo de Drive (${response.status}: ${response.statusText})`);
      }

      console.log('[GDrive] Respuesta recibida, status:', response.status);
      console.log('[GDrive] Content-Length:', response.headers.get('content-length'));
      console.log('[GDrive] response.body:', response.body ? 'existe' : 'NULL');

      if (!response.body) {
        throw new Error('Respuesta sin cuerpo (response.body es null). El servidor no soporta streaming.');
      }

      const contentLength = response.headers.get('content-length');
      const parsedContentLength = contentLength ? parseInt(contentLength, 10) : 0;
      const effectiveTotalBytes = parsedContentLength > 0 ? parsedContentLength : totalBytes;
      const totalMb = effectiveTotalBytes > 0 ? (effectiveTotalBytes / (1024 * 1024)).toFixed(1) : '--';

      console.log('[GDrive] Total bytes a descargar:', effectiveTotalBytes, '=', totalMb + ' MB');

      const reader = response.body.getReader();
      let receivedBytes = 0;
      const chunks = [];
      let chunkIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;
        chunkIndex++;

        const loadedMb = (receivedBytes / (1024 * 1024)).toFixed(1);
        const percent = effectiveTotalBytes > 0 ? Math.min(100, Math.round((receivedBytes / effectiveTotalBytes) * 100)) : Math.round((chunkIndex / 100) * 100);

        console.log(`[GDrive] Chunk ${chunkIndex}: ${loadedMb} MB / ${totalMb} MB (${percent}%)`);

        onProgress?.({
          percent,
          loadedMb,
          totalMb,
          phase: `Descargando: ${loadedMb} MB ${effectiveTotalBytes > 0 ? `/ ${totalMb} MB (${percent}%)` : ''}`
        });

        this.onStatusUpdate?.(`📥 Descargando ${fileName}: ${loadedMb} MB ${effectiveTotalBytes > 0 ? `/ ${totalMb} MB (${percent}%)` : ''}`);
      }

      const finalLoadedMb = (receivedBytes / (1024 * 1024)).toFixed(1);
      console.log('[GDrive] Descarga completada:', receivedBytes, 'bytes =', finalLoadedMb + ' MB');
      onProgress?.({ percent: 100, loadedMb: finalLoadedMb, totalMb: totalMb !== '--' ? totalMb : finalLoadedMb, phase: 'Archivo descargado en RAM. Procesando...' });

      const blob = new Blob(chunks, { type: 'application/zip' });
      const file = new File([blob], fileName, { type: 'application/zip' });

      this.onStatusUpdate?.(`✅ Descarga completada: ${fileName}`);
      console.log('[GDrive] Archivo creado:', file.name, file.size, 'bytes');
      if (this.onFileDownloaded) {
        await this.onFileDownloaded(file);
      }
      return file;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[GDrive] Error durante la descarga:', err);
      if (err.name === 'AbortError') {
        throw new Error('Descarga cancelada por tiempo de espera agotado (5 min). Intenta de nuevo.');
      }
      throw new Error(`Error en la descarga: ${err.message}`);
    }
  }

  abortDownload() {
    if (this.downloadAbortController) {
      this.downloadAbortController.abort();
    }
  }
}