# Configuración Mercado Pago Point

## 1. Crear tu aplicación en Mercado Pago Developers

1. Ve a [developers.mercadopago.com](https://developers.mercadopago.com) e inicia sesión con tu cuenta de Mercado Pago.
2. Haz clic en **Crear aplicación** (o Tus integraciones → Ver todas → Crear aplicación).
3. Ingresa un nombre (ej. `Retail OS - Mi Tienda`).
4. Selecciona **Pagos presenciales** → **Mercado Pago Point**.
5. Confirma y acepta los términos.

## 2. Obtener credenciales de prueba

Después de crear la aplicación, se generan automáticamente:

| Credencial | Uso |
|-----------|-----|
| `Public Key` | Frontend (no usado en Retail OS POS) |
| `Access Token TEST-xxxx` | Backend — integración de prueba |

> Para desarrollo local usa siempre el **Access Token de prueba** (TEST-...). \
> Para producción, usa el **OAuth Authorization Code Flow** (nunca el token de producción manual).

## 3. Configurar variables de entorno

Crea un archivo `.env` en la raíz del repositorio:

```bash
# Mercado Pago Point
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxx
MERCADOPAGO_ENV=test                     # test | production
MERCADOPAGO_WEBHOOK_SECRET=              # (dejar vacío en dev)

# OAuth (solo producción — no requerido para dev)
MERCADOPAGO_CLIENT_ID=
MERCADOPAGO_CLIENT_SECRET=
MERCADOPAGO_REDIRECT_URI=https://tu-dominio.com/payments/mercadopago/callback

# API
PORT=3000
RETAIL_DEV_MODE=true                     # activa endpoints de desarrollo
DATABASE_URL=postgresql://retail:retail@localhost:5432/retail_os
```

## 4. Conectar en modo desarrollo (Settings)

1. Abre Retail OS → **⚙️ Configuración** → **Pagos**.
2. En la tarjeta **Mercado Pago Point**, haz clic en **🧪 Usar Access Token de prueba**.
3. Ingresa tu `TEST-xxxx...` y haz clic en **Conectar en modo dev**.
4. El status cambia a **Modo Dev** y el emulador está listo.

## 5. Conectar en producción (OAuth)

1. Abre Retail OS → **⚙️ Configuración** → **Pagos**.
2. En la tarjeta **Mercado Pago Point**, haz clic en **🔐 Conectar con OAuth**.
3. Serás redirigido a Mercado Pago para autorizar la integración.
4. Tras autorizar, los tokens se almacenan cifrados en el servidor.
5. El sistema descubre automáticamente los terminales Point asignados a tu cuenta.

## 6. Descubrimiento de terminales

Después de conectar via OAuth:
- La API descarga la lista de terminales Point asignados (`Point Mini`, `Point Smart`, `Point Air`).
- Ve a **Configuración → Pagos → Terminales** y asigna los terminales a tu tienda.

## 7. Flujo de cobro con terminal real

```
POS → Orchestrator → MercadoPagoPointAdapter
         ↓
   POST /v1/orders (Orders API)
     - type: "point"
     - config.point.terminal_id: <id del terminal asignado>
     - transactions.payments[].amount: <monto en centavos>
         ↓
   Terminal Point recibe la orden y espera tarjeta del cliente
         ↓
   MP envía webhook a MERCADOPAGO_WEBHOOK_SECRET
         ↓
   API actualiza estado → rwp.payment.completed
         ↓
   POS CheckoutSaga finaliza la venta
```

## 8. Flujo de cobro con emulador (desarrollo)

```
POS → Orchestrator → MercadoPagoPointSimulator (manual mode)
         ↓
   Shell abre panel "Terminal Virtual MP" automáticamente
         ↓
   Desarrollador: Insert Card → Process → Approve
         ↓
   Terminal envía RWP command → pos.simulator.finalizePayment
         ↓
   CheckoutSaga recibe rwp.payment.completed → venta completada
```

## Diferencias test vs producción

| Aspecto | Test (TEST-xxx) | Producción (OAuth) |
|---------|----------------|-------------------|
| Credenciales | Manual (Settings Dev) | OAuth automático |
| Terminales | Emulador virtual | Point físico |
| Webhooks | No requerido | URL pública requerida |
| Dinero | No se procesa | Transacciones reales |
| `MERCADOPAGO_ENV` | `test` | `production` |

## Referencia oficial
- [Documentación MP Point](https://developers.mercadopago.com/es/docs/mp-point/introduction)
- [Orders API](https://developers.mercadopago.com/es/reference/instore-orders-v2/_instore_qr_seller_collectors_user_id_stores_external_store_id_pos_external_pos_id_orders/post)
- [OAuth Authorization Code](https://developers.mercadopago.com/es/docs/security/oauth/creation)
