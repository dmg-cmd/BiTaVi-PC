/**
 * Conector de Google Fotos para BiTaVi PC
 * Utiliza Google Identity Services (OAuth 2.0) y Google Photos Library API / Photos Picker
 */
export class GooglePhotosConnector {
  constructor(onPhotosDownloaded, onStatusUpdate) {
    this.onPhotosDownloaded = onPhotosDownloaded;
    this.onStatusUpdate = onStatusUpdate;
    this.tokenClient = null;
    this.accessToken = null;
    // Si no hay Client ID específico de Fotos, aprovecha el de Drive si ya fue configurado
    this.clientId = localStorage.getItem('bitavi_gphotos_client_id') || 
                    localStorage.getItem('bitavi_gdrive_client_id') || '';
    this.isGapiLoaded = false;
    this.isGsiLoaded = false;
    this.abortController = null;
  }

  saveCredentials(clientId) {
    this.clientId = (clientId || '').trim();
    localStorage.setItem('bitavi_gphotos_client_id', this.clientId);
  }

  loadGoogleScripts() {
    return new Promise((resolve) => {
      let gapiDone = !!window.gapi;
      let gsiDone = !!(window.google && window.google.accounts);

      const checkReady = () => {
        if (gapiDone && gsiDone) {
          this.isGapiLoaded = true;
          this.isGsiLoaded = true;
          resolve(true);
        }
      };

      if (!window.gapi) {
        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.onload = () => {
          gapiDone = true;
          checkReady();
        };
        script1.onerror = () => {
          console.warn('[GPhotos] Error cargando api.js');
          gapiDone = true;
          checkReady();
        };
        document.body.appendChild(script1);
      }

      if (!window.google || !window.google.accounts) {
        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.onload = () => {
          gsiDone = true;
          checkReady();
        };
        script2.onerror = () => {
          console.warn('[GPhotos] Error cargando gsi/client');
          gsiDone = true;
          checkReady();
        };
        document.body.appendChild(script2);
      }

      if (gapiDone && gsiDone) {
        this.isGapiLoaded = true;
        this.isGsiLoaded = true;
        resolve(true);
      }
    });
  }

  async authenticate() {
    await this.loadGoogleScripts();

    if (!this.clientId) {
      throw new Error('Se requiere configurar el Client ID de Google Cloud Console.');
    }

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      throw new Error('El cliente de Google Identity Services no pudo cargarse en este entorno.');
    }

    return new Promise((resolve, reject) => {
      try {
        // Scopes para lectura de fotos y álbumes de Google Photos
        const scope = 'https://www.googleapis.com/auth/photoslibrary.readonly';

        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope,
          callback: (response) => {
            if (response.error !== undefined) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            this.accessToken = response.access_token;
            console.log('[GPhotos] Token de acceso obtenido correctamente');
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
      await this.authenticate();
      return;
    }
    // Verificar validez haciendo una llamada liviana
    try {
      const verifyResp = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=1', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (!verifyResp.ok && (verifyResp.status === 401 || verifyResp.status === 403)) {
        console.warn('[GPhotos] Token inválido o expirado, solicitando nuevo token...');
        await this.authenticate();
      }
    } catch (e) {
      console.warn('[GPhotos] Error verificando token:', e);
      await this.authenticate();
    }
  }

  /**
   * Obtiene la lista de fotos recientes de Google Photos
   * @param {number} pageSize 
   * @param {string|null} pageToken 
   */
  async listRecentPhotos(pageSize = 50, pageToken = null) {
    await this.ensureAuthenticated();
    this.onStatusUpdate?.('🔍 Consultando tus fotos recientes en Google Fotos...');

    let url = `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=${Math.min(pageSize, 100)}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });

    if (!response.ok) {
      const errBody = await response.text();
      this.handleApiError(response.status, errBody);
    }

    const data = await response.json();
    return {
      items: data.mediaItems || [],
      nextPageToken: data.nextPageToken || null
    };
  }

  /**
   * Obtiene los álbumes creados en la cuenta de Google Photos
   * @param {number} pageSize 
   * @param {string|null} pageToken 
   */
  async listAlbums(pageSize = 30, pageToken = null) {
    await this.ensureAuthenticated();
    this.onStatusUpdate?.('📁 Consultando tus álbumes en Google Fotos...');

    let url = `https://photoslibrary.googleapis.com/v1/albums?pageSize=${Math.min(pageSize, 50)}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });

    if (!response.ok) {
      const errBody = await response.text();
      this.handleApiError(response.status, errBody);
    }

    const data = await response.json();
    return {
      albums: data.albums || [],
      nextPageToken: data.nextPageToken || null
    };
  }

  /**
   * Obtiene las fotos pertenecientes a un álbum específico
   * @param {string} albumId 
   * @param {number} pageSize 
   * @param {string|null} pageToken 
   */
  async listAlbumPhotos(albumId, pageSize = 50, pageToken = null) {
    await this.ensureAuthenticated();
    this.onStatusUpdate?.('🖼️ Cargando fotos del álbum seleccionado...');

    const body = {
      albumId,
      pageSize: Math.min(pageSize, 100)
    };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errBody = await response.text();
      this.handleApiError(response.status, errBody);
    }

    const data = await response.json();
    return {
      items: data.mediaItems || [],
      nextPageToken: data.nextPageToken || null
    };
  }

  /**
   * Busca fotos de Google Photos en un día específico (ej. el día de la ruta cargada)
   * @param {Date|string} date Fecha o string YYYY-MM-DD
   * @param {number} pageSize 
   */
  async searchPhotosByDate(date, pageSize = 50) {
    await this.ensureAuthenticated();
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) {
      throw new Error('Fecha inválida para filtrar fotos de Google Fotos.');
    }

    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    this.onStatusUpdate?.(`📅 Buscando fotos del día ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}...`);

    const body = {
      pageSize: Math.min(pageSize, 100),
      filters: {
        dateFilter: {
          dates: [
            { year, month, day }
          ]
        }
      }
    };

    const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errBody = await response.text();
      this.handleApiError(response.status, errBody);
    }

    const data = await response.json();
    return {
      items: data.mediaItems || [],
      nextPageToken: data.nextPageToken || null
    };
  }

  /**
   * Descarga los elementos multimedia seleccionados y los convierte en objetos File
   * con metadatos de Google Photos para PhotoHandler
   * @param {Array<object>} items Lista de mediaItems de Google Photos
   * @param {Function} onProgress Callback de progreso
   * @returns {Promise<Array<File>>}
   */
  async downloadPhotos(items, onProgress = null) {
    if (!items || items.length === 0) return [];

    const downloadedFiles = [];
    const total = items.length;

    for (let i = 0; i < total; i++) {
      const item = items[i];
      const fileName = item.filename || `gphoto_${item.id}.jpg`;
      const creationDate = item.mediaMetadata?.creationTime 
        ? new Date(item.mediaMetadata.creationTime) 
        : new Date();

      onProgress?.({
        current: i + 1,
        total,
        percent: Math.round(((i + 1) / total) * 100),
        fileName,
        phase: `Descargando foto ${i + 1} de ${total}: ${fileName}`
      });

      this.onStatusUpdate?.(`📥 Descargando foto ${i + 1} de ${total} (${fileName})...`);

      try {
        // Intentar descargar en calidad completa (=d). Si falla o CORS restringe, fallback a alta resolución (=w2048-h2048)
        let blob = null;
        try {
          const resFull = await fetch(`${item.baseUrl}=d`);
          if (resFull.ok) {
            blob = await resFull.blob();
          }
        } catch (e) {
          console.warn(`[GPhotos] Descarga directa =d no disponible para ${fileName}, aplicando fallback de alta resolución:`, e.message);
        }

        if (!blob) {
          const resFallback = await fetch(`${item.baseUrl}=w2048-h2048`);
          if (!resFallback.ok) {
            throw new Error(`Error HTTP ${resFallback.status}`);
          }
          blob = await resFallback.blob();
        }

        // Crear objeto File con nombre, tipo MIME y fecha
        const mimeType = item.mimeType || blob.type || 'image/jpeg';
        const file = new File([blob], fileName, {
          type: mimeType,
          lastModified: creationDate.getTime()
        });

        // Adjuntar metadatos de Google Photos para correlación y cámara
        file._gphotosMetadata = {
          id: item.id,
          creationTime: item.mediaMetadata?.creationTime,
          photo: item.mediaMetadata?.photo || null,
          width: item.mediaMetadata?.width,
          height: item.mediaMetadata?.height
        };

        downloadedFiles.push(file);
      } catch (err) {
        console.error(`[GPhotos] Error descargando ${fileName}:`, err);
      }
    }

    this.onStatusUpdate?.(`✅ Se descargaron ${downloadedFiles.length} fotos desde Google Fotos.`);

    if (this.onPhotosDownloaded && downloadedFiles.length > 0) {
      await this.onPhotosDownloaded(downloadedFiles);
    }

    return downloadedFiles;
  }

  handleApiError(status, errBody) {
    console.error(`[GPhotos] Error ${status}:`, errBody);
    let msg = `Error en Google Photos API (${status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) {
        msg = parsed.error.message;
      }
    } catch (_) {}

    if (status === 403) {
      throw new Error(`Acceso denegado (403): Asegúrate de tener habilitada la "Google Photos Library API" en tu proyecto de Google Cloud Console y de agregar el scope de lectura.`);
    }
    throw new Error(msg);
  }
}
