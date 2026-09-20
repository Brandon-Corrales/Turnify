import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MensajeChatbot } from '../../database/entities';
import { NegociosModule } from '../negocios/negocios.module';
import { ReservasModule } from '../reservas/reservas.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { ChatbotGateway } from './chatbot.gateway';
import { ChatbotService } from './chatbot.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { LLM_CLIENT } from './providers/llm-client.interface';
import { GroqLlmClient } from './providers/groq-llm-client.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MensajeChatbot]),
    JwtModule.register({}), // WsJwtGuard verifica con el secreto leído de ConfigService, igual que JwtAuthGuard
    NegociosModule,
    ServiciosModule,
    ReservasModule,
    // Trae LimitePlanGratisGuard + LimitesPlanService ya exportados —
    // mismo patrón que UsuariosModule/ServiciosModule/ReservasModule.
    SuscripcionesModule,
  ],
  providers: [
    ChatbotGateway,
    ChatbotService,
    WsJwtGuard,
    { provide: LLM_CLIENT, useClass: GroqLlmClient },
  ],
})
export class ChatbotModule {}
