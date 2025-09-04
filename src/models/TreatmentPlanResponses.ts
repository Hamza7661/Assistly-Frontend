import { TreatmentPlan } from './TreatmentPlan';

export class TreatmentPlanListResponse {
  status: string;
  data: { plans: TreatmentPlan[]; count: number };

  constructor(json: any) {
    this.status = json.status;
    const list = (json.data?.plans || []).map((p: any) => new TreatmentPlan(p));
    this.data = { plans: list, count: json.data?.count ?? list.length };
  }
}

export class TreatmentPlanMutationResponse {
  status: string;
  message?: string;
  data: { plan: TreatmentPlan };

  constructor(json: any) {
    this.status = json.status;
    this.message = json.message;
    this.data = { plan: new TreatmentPlan(json.data?.plan) };
  }
}


