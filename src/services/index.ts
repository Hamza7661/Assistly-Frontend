// Lazy-loaded service exports
export const useAuthService = () => import('./authService').then(module => module.authService);
export const usePackageService = () => import('./packageService').then(module => module.packageService);

// Export the base HttpService class for inheritance
export { HttpService } from './httpService';

// Lazy-loaded service exports
export const useTemplateService = () => import('./templateService').then(module => module.templateService);
export const useQuestionnareService = () => import('./questionnareService').then(module => module.questionnareService);
export const useTreatmentPlanService = () => import('./treatmentPlanService').then(module => module.treatmentPlanService);
export const useAvailabilityService = () => import('./availabilityService').then(module => module.availabilityService);
export const useAppointmentService = () => import('./appointmentService').then(module => module.appointmentService);
export const useLeadService = () => import('./leadService').then(module => module.leadService);
export const useIntegrationService = () => import('./integrationService').then(module => module.integrationService);
export const useWidgetService = () => import('./widgetService').then(module => module.widgetService);
export const useChatbotWorkflowService = () => import('./chatbotWorkflowService').then(module => module.chatbotWorkflowService);
export const useSubscriptionService = () => import('./subscriptionService').then(module => module.subscriptionService);
export const useQuestionTypeService = () => import('./questionTypeService').then(module => module.questionTypeService);
