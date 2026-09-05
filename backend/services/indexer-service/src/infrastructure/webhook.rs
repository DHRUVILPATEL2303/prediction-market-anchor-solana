use crate::domain::events::EventProvider;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use async_trait::async_trait;
use serde_json::Value;
use shared_domain::RawSolanaEvent;
use std::error::Error;
use tokio::sync::mpsc::Sender;

pub struct WebhookProvider {
    pub port: u16,
}

#[async_trait]
impl EventProvider for WebhookProvider {
    async fn start_listening(&self, sender: Sender<RawSolanaEvent>) -> Result<(), Box<dyn Error>> {
        let sender_data = web::Data::new(sender);
        let port = self.port;
        
        tokio::spawn(async move {
            let _ = HttpServer::new(move || {
                App::new()
                    .app_data(sender_data.clone())
                    .route("/webhook", web::post().to(handle_webhook))
            })
            .bind(("0.0.0.0", port))
            .unwrap()
            .run()
            .await;
        });
        
        Ok(())
    }
}

async fn handle_webhook(
    payload: web::Json<Vec<Value>>,
    sender: web::Data<Sender<RawSolanaEvent>>,
) -> impl Responder {
    for tx in payload.0 {
        let _ = sender.send(RawSolanaEvent::Transaction(tx.to_string())).await;
    }
    HttpResponse::Ok().finish()
}
