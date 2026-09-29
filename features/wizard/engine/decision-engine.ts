// ============================================================================
// WIZARD DECISION ENGINE (ADAPTIVE FASHION ASSISTANT)
// Decides what questions to ask, what to skip automatically, and translates
// backend technical ambiguity into friendly human questions.
// ============================================================================

import { 
  DestinationPreset, 
  StylePreset, 
  ProductChoiceViewModel, 
  ColorChoiceViewModel, 
  ShotChoiceViewModel 
} from '../models/wizard.types';

export type MacroStep = 'UPLOAD' | 'CHOOSE' | 'PREPARE' | 'CREATE';

export type SubStep = 
  | 'WELCOME'
  | 'UPLOAD'
  | 'PRODUCTS'
  | 'SHOTS'
  | 'DESTINATION'
  | 'STYLE'
  | 'MODEL'
  | 'HUMAN_REVIEW'
  | 'SUMMARY'
  | 'GENERATION'
  | 'RESULTS';

export interface WizardQuestion {
  id: string;
  type: 'AMBIGUOUS_ORIENTATION' | 'CONFIRM_SAME_MODEL' | 'UNCLEAR_DETAILS';
  title: string;
  description: string;
  targetId: string;
  options: { label: string; value: string }[];
}

export interface AutoDecision {
  type: string;
  reason: string;
  appliedSetting: string;
}

export interface WizardDecisionState {
  visibleMacroStep: MacroStep;
  currentSubStep: SubStep;
  requiredQuestions: WizardQuestion[];
  autoAppliedDecisions: AutoDecision[];
  skippableSections: string[];
  isSingleGarmentSingleColor: boolean;
  isMultiVariantSingleProduct: boolean;
  isMultipleProducts: boolean;
  isGhostMannequinActive: boolean;
}

export interface WizardFormState {
  products: ProductChoiceViewModel[];
  shots: ShotChoiceViewModel[];
  destination: DestinationPreset;
  style: StylePreset;
  modelId: string;
}

export class FriendlyErrorMapper {
  static toUserMessage(errorCodeOrMessage?: string): string {
    if (!errorCodeOrMessage) {
      return 'Ocurrió un problema temporal. Por favor, intentá nuevamente.';
    }

    const lower = errorCodeOrMessage.toLowerCase();

    if (lower.includes('empty') || lower.includes('no garment') || lower.includes('no_garment')) {
      return 'No encontramos una prenda claramente visible. Asegurate de que la prenda se aprecie en plano general.';
    }

    if (lower.includes('invalid') || lower.includes('mime') || lower.includes('magic')) {
      return 'No pudimos leer esta imagen. Probá con un archivo JPG, PNG o WebP.';
    }

    if (lower.includes('oversized') || lower.includes('10mb') || lower.includes('large')) {
      return 'La foto es demasiado pesada. El tamaño máximo por imagen es de 10 MB.';
    }

    if (lower.includes('quality') || lower.includes('blur') || lower.includes('pequeña')) {
      return 'La imagen está demasiado borrosa o pequeña para detectar los detalles de confección.';
    }

    if (lower.includes('network') || lower.includes('timeout') || lower.includes('fetch')) {
      return 'Hubo una pausa en la conexión. Revisá tu internet e intentá nuevamente.';
    }

    if (lower.includes('analysis_unavailable') || lower.includes('no pudimos analizar')) {
      return 'No pudimos analizar automáticamente esta foto. Probá nuevamente o subí otra imagen.';
    }

    if (lower.includes('ai_configuration_required') || lower.includes('configurá ai_mode') || lower.includes('falta configurar gemini') || lower.includes('falta configurar fal')) {
      return errorCodeOrMessage;
    }

    return 'No pudimos analizar esta foto en este momento. Podés intentar nuevamente o probar con otra fotografía.';
  }
}

export class WizardDecisionEngine {
  /**
   * Computes adaptive steps, automatic skips, and questions based on detected products and user choices.
   */
  static evaluate(
    formState: WizardFormState,
    currentSubStep: SubStep,
    unresolvedConflicts: { property: string; reason?: string }[] = []
  ): WizardDecisionState {
    const { products, destination, modelId } = formState;

    const totalProducts = products.length;
    const totalColors = products.reduce((acc, p) => acc + p.colors.length, 0);

    const isSingleGarmentSingleColor = totalProducts === 1 && totalColors === 1;
    const isMultiVariantSingleProduct = totalProducts === 1 && totalColors > 1;
    const isMultipleProducts = totalProducts > 1;

    const isGhostMannequinActive = modelId === 'model-no-model';

    const skippableSections: string[] = [];
    const autoAppliedDecisions: AutoDecision[] = [];
    const requiredQuestions: WizardQuestion[] = [];

    // Rule A: Single product + single color -> skip product selector & go directly to shots
    if (isSingleGarmentSingleColor) {
      skippableSections.push('PRODUCT_SELECTOR');
      autoAppliedDecisions.push({
        type: 'AUTO_SELECT_SINGLE_GARMENT',
        reason: 'Se detectó 1 único modelo con 1 solo color; no requiere selección manual de prendas.',
        appliedSetting: 'Unico producto preseleccionado',
      });
    }

    // Rule D: Destination = Mercado Libre -> Preset White background + 1:1 + FRONT/SIDE/BACK
    if (destination === 'MERCADO_LIBRE') {
      autoAppliedDecisions.push({
        type: 'MERCADO_LIBRE_PRESET',
        reason: 'Mercado Libre exige fondo blanco reglamentario y tomas canónicas.',
        appliedSetting: 'Fondo blanco puro, relación 1:1, tomas frente/costado/espalda',
      });
    }

    // Rule E: Destination = Instagram -> Preset Lifestyle + 4:5
    if (destination === 'INSTAGRAM') {
      autoAppliedDecisions.push({
        type: 'INSTAGRAM_PRESET',
        reason: 'Instagram rinde mejor con ambientación lifestyle y formato 4:5.',
        appliedSetting: 'Estilo lifestyle urbano, tomas dinámicas',
      });
    }

    // Rule F: Ghost Mannequin -> Hide human models catalog
    if (isGhostMannequinActive) {
      skippableSections.push('HUMAN_MODEL_CATALOG');
      autoAppliedDecisions.push({
        type: 'GHOST_MANNEQUIN_SELECTED',
        reason: 'Se eligió maniquí invisible; se oculta el catálogo de modelos humanas/masculinas.',
        appliedSetting: 'Maniquí invisible activo',
      });
    }

    // Rule G: Conflict translation (Never technical)
    for (const conflict of unresolvedConflicts) {
      if (conflict.property.toLowerCase().includes('group') || conflict.property.toLowerCase().includes('product')) {
        requiredQuestions.push({
          id: `q-conflict-${Date.now()}`,
          type: 'CONFIRM_SAME_MODEL',
          title: '¿Estas fotos corresponden al mismo modelo?',
          description: 'Detectamos ligeras diferencias en las fotos. Confirmá si son el mismo diseño en distintos colores.',
          targetId: conflict.property,
          options: [
            { label: 'Sí, son el mismo modelo en distintos colores', value: 'SAME_MODEL' },
            { label: 'No, son modelos o cortes diferentes', value: 'DIFFERENT_MODELS' },
          ],
        });
      }
    }

    // Map internal subStep to 4 visible macro steps
    let visibleMacroStep: MacroStep = 'UPLOAD';
    if (currentSubStep === 'UPLOAD' || currentSubStep === 'WELCOME') {
      visibleMacroStep = 'UPLOAD';
    } else if (currentSubStep === 'PRODUCTS' || currentSubStep === 'SHOTS') {
      visibleMacroStep = 'CHOOSE';
    } else if (currentSubStep === 'DESTINATION' || currentSubStep === 'STYLE' || currentSubStep === 'MODEL') {
      visibleMacroStep = 'PREPARE';
    } else if (currentSubStep === 'SUMMARY' || currentSubStep === 'GENERATION' || currentSubStep === 'RESULTS') {
      visibleMacroStep = 'CREATE';
    }

    return {
      visibleMacroStep,
      currentSubStep,
      requiredQuestions,
      autoAppliedDecisions,
      skippableSections,
      isSingleGarmentSingleColor,
      isMultiVariantSingleProduct,
      isMultipleProducts,
      isGhostMannequinActive,
    };
  }

  /**
   * Calculates the next optimal step using progressive disclosure and automatic skips.
   */
  static getNextStep(
    currentStep: SubStep,
    formState: WizardFormState,
    hasConflicts: boolean = false
  ): SubStep {
    const totalProducts = formState.products.length;
    const totalColors = formState.products.reduce((acc, p) => acc + p.colors.length, 0);

    switch (currentStep) {
      case 'WELCOME':
        return 'UPLOAD';

      case 'UPLOAD':
        if (hasConflicts) return 'HUMAN_REVIEW';
        // Always route through PRODUCTS so the user can confirm the garment identity/name!
        return 'PRODUCTS';

      case 'HUMAN_REVIEW':
        return 'PRODUCTS';

      case 'PRODUCTS':
        return 'SHOTS';

      case 'SHOTS':
        return 'DESTINATION';

      case 'DESTINATION':
        // If Mercado Libre or Instagram, user can already move straight to MODEL or SUMMARY
        // but we allow them to review style smoothly if desired:
        return 'STYLE';

      case 'STYLE':
        // If Ghost Mannequin was preselected, skip human model step straight to SUMMARY!
        if (formState.modelId === 'model-no-model') {
          return 'SUMMARY';
        }
        return 'MODEL';

      case 'MODEL':
        return 'SUMMARY';

      case 'SUMMARY':
        return 'GENERATION';

      case 'GENERATION':
        return 'RESULTS';

      case 'RESULTS':
        return 'WELCOME';

      default:
        return 'UPLOAD';
    }
  }

  /**
   * Calculates previous step preserving all user configuration without resets.
   */
  static getPreviousStep(
    currentStep: SubStep,
    formState: WizardFormState
  ): SubStep {
    const totalProducts = formState.products.length;
    const totalColors = formState.products.reduce((acc, p) => acc + p.colors.length, 0);

    switch (currentStep) {
      case 'UPLOAD':
        return 'WELCOME';

      case 'PRODUCTS':
        return 'UPLOAD';

      case 'SHOTS':
        return 'PRODUCTS';

      case 'DESTINATION':
        return 'SHOTS';

      case 'STYLE':
        return 'DESTINATION';

      case 'MODEL':
        return 'STYLE';

      case 'SUMMARY':
        if (formState.modelId === 'model-no-model') {
          return 'STYLE';
        }
        return 'MODEL';

      default:
        return 'UPLOAD';
    }
  }
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  autoNotice?: string;
}

export class ProductionConfigurationValidator {
  /**
   * Validates semantic and technical coherence across user choices before creating production.
   * Catches incompatible settings (e.g. Mercado Libre with Lifestyle, 0 colors selected, etc.)
   */
  static validate(formState: WizardFormState): ConfigurationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const activeProducts = formState.products.filter((p) => p.selected !== false);
    if (activeProducts.length === 0) {
      errors.push('No hay prendas seleccionadas para la producción.');
    }

    // 1. Color variants validation
    const totalSelectedColors = formState.products.reduce(
      (acc, p) => acc + p.colors.filter((c) => c.selected).length,
      0
    );

    if (totalSelectedColors === 0) {
      errors.push('Debés seleccionar al menos un color para producir.');
    }

    // 2. Shots validation
    const selectedShots = formState.shots.filter((s) => s.selected);
    if (selectedShots.length === 0) {
      errors.push('Elegí al menos una toma (Frente, Costado, etc.) para tu producción.');
    }

    // 3. Garment name validation
    for (const p of activeProducts) {
      const name = p.confirmedIdentity?.confirmedName || p.title;
      if (!name || name.trim().length === 0) {
        errors.push(`Falta indicar el nombre comercial para la prenda "${p.category || 'Prenda'}".`);
      }
    }

    // 4. Destination & Style Coherence Matrix
    if (formState.destination === 'MERCADO_LIBRE') {
      if (formState.style !== 'FONDO_BLANCO') {
        warnings.push(
          'Cambiaste la recomendación para Mercado Libre. Recordá que Mercado Libre exige Fondo Blanco puro para no penalizar la visibilidad del producto.'
        );
      }
    } else if (formState.destination === 'INSTAGRAM') {
      if (formState.style === 'FONDO_BLANCO') {
        warnings.push(
          'Para Instagram suele funcionar mejor un estilo con ambientación (Lifestyle o Estudio) en lugar de fondo blanco plano.'
        );
      }
    }

    // 5. Model vs Shots Coherence
    const isActionSelected = selectedShots.some((s) => s.id === 'ACTION');
    if (formState.modelId === 'model-no-model' && isActionSelected) {
      warnings.push(
        'La toma "En movimiento" sobre maniquí invisible mostrará la prenda estática con volumen pero sin dinamismo humano.'
      );
    }

    // Auto-notice generator
    let autoNotice: string | undefined;
    if (formState.destination === 'MERCADO_LIBRE' && formState.style === 'FONDO_BLANCO') {
      autoNotice = 'Aplicamos automáticamente Fondo Blanco reglamentario para Mercado Libre.';
    } else if (formState.destination === 'INSTAGRAM' && formState.style === 'LIFESTYLE') {
      autoNotice = 'Aplicamos automáticamente estilo Lifestyle Urbano optimizado para Instagram.';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      autoNotice,
    };
  }
}

