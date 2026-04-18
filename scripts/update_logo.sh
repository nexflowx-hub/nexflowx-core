sed -i 's/merchant_name: tx.payee.username,/merchant_name: "Walluxe",/' ~/nexflowx-api-v2/src/server.ts
sed -i 's|logo_url: "https://ui-avatars.com/api/?name=" + tx.payee.username + "&background=random",|logo_url: "https://walluxeuk.com/images/walluxe-logo-nome.png",|' ~/nexflowx-api-v2/src/server.ts
sed -i 's|logo_url: "https://checkout.nexflowx.tech/walluxe-logo-nome.png",|logo_url: "https://walluxeuk.com/images/walluxe-logo-nome.png",|' ~/nexflowx-api-v2/src/server.ts
