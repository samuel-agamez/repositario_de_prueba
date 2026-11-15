import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';

function variableObligatoria(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
}

export function getFirebaseApp(): App {
  const [app] = getApps();
  if (app) {
    return app;
  }

  const privateKey = variableObligatoria('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
  return initializeApp({
    credential: cert({
      projectId: variableObligatoria('FIREBASE_PROJECT_ID'),
      clientEmail: variableObligatoria('FIREBASE_CLIENT_EMAIL'),
      privateKey,
    }),
  });
}
