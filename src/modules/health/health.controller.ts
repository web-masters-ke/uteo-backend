import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

const KENYAN_COUNTIES = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu', 'Machakos', 'Kajiado',
  'Uasin Gishu', 'Kilifi', 'Nyeri', 'Meru', 'Kakamega', 'Bungoma', 'Trans Nzoia',
  'Laikipia', 'Nyandarua', "Murang'a", 'Kirinyaga', 'Embu', 'Tharaka-Nithi',
  'Lamu', 'Taita-Taveta', 'Kwale', 'Garissa', 'Wajir', 'Mandera', 'Marsabit',
  'Isiolo', 'Samburu', 'Turkana', 'West Pokot', 'Baringo', 'Elgeyo-Marakwet',
  'Nandi', 'Bomet', 'Kericho', 'Narok', 'Vihiga', 'Busia', 'Siaya', 'Homa Bay',
  'Migori', 'Kisii', 'Nyamira', 'Tana River', 'Kitui', 'Makueni',
];

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'uteo-api', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('locations/counties')
  counties() {
    return KENYAN_COUNTIES.map((name, i) => ({ id: `county-${i + 1}`, name }));
  }
}
