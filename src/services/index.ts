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
